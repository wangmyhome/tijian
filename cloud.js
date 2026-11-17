(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QuizCloud = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const copy = value => structuredClone(value);
  class CloudError extends Error {
    constructor(message, code = '') { super(message); this.code = code; }
  }
  class Client {
    constructor(config, options = {}) {
      this.config = config;
      this.fetch = options.fetch || globalThis.fetch.bind(globalThis);
      this.storage = options.storage || globalThis.localStorage;
      this.key = 'tijian-auth:' + config.url;
      this.session = null;
      try {
        const cached = JSON.parse(this.storage.getItem(this.key));
        if (cached?.access_token && cached?.refresh_token && cached?.user?.id && cached.user.email === config.adminEmail) this.session = cached;
      } catch (_) { /* A damaged session never prevents opening the login form. */ }
    }
    remember(session) {
      this.session = session;
      if (session) this.storage.setItem(this.key, JSON.stringify(session));
      else this.storage.removeItem(this.key);
    }
    async request(path, { method = 'GET', body, token, auth = false } = {}) {
      const headers = { apikey: this.config.key, 'Content-Type': 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      let response;
      try {
        response = await this.fetch(this.config.url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000), cache: 'no-store' });
      } catch (_) { throw new CloudError('暂时无法连接云端，数据已保存在本机，联网后会重试。', 'network'); }
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (auth && response.status === 400 && data?.error_code === 'invalid_credentials') throw new CloudError('账号或密码错误，请重新输入。', 'credentials');
        if (data?.error_code === 'email_not_confirmed') throw new CloudError('账号尚未确认，请在 Supabase 创建用户时勾选 Auto Confirm User。', 'credentials');
        if (response.status === 401 || (auth && response.status === 400)) throw new CloudError('登录已过期，请重新登录。本机未同步记录会保留。', 'auth');
        if (['PGRST205', 'PGRST202', '42P01', '42883'].includes(data?.code)) throw new CloudError('云端数据表尚未就绪，请先执行项目中的初始化 SQL。', 'setup');
        throw new CloudError(response.status === 403 ? '当前账号没有访问学习数据的权限。' : '云端操作失败，请稍后重试。', String(response.status));
      }
      return data;
    }
    async login(username, password) {
      if (username.trim().toLowerCase() !== 'admin') throw new CloudError('账号或密码错误，请重新输入。', 'credentials');
      const session = await this.request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: this.config.adminEmail, password }, auth: true });
      if (session.user?.email !== this.config.adminEmail) throw new CloudError('当前账号无法登录题间。', 'credentials');
      session.expires_at ||= Math.floor(Date.now() / 1000) + session.expires_in;
      this.remember(session);
      return session.user;
    }
    async token() {
      if (!this.session) throw new CloudError('请先登录。', 'auth');
      if (this.session.expires_at * 1000 > Date.now() + 60000) return this.session.access_token;
      if (this.refreshing) return this.refreshing;
      const refresh = async () => {
        // Tabs on the same site share refresh tokens; serialize token rotation.
        try {
          const cached = JSON.parse(this.storage.getItem(this.key));
          if (cached?.user?.id === this.session.user.id && cached.expires_at * 1000 > Date.now() + 60000) { this.session = cached; return cached.access_token; }
        } catch (_) {}
        const session = await this.request('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: this.session.refresh_token }, auth: true });
        session.expires_at ||= Math.floor(Date.now() / 1000) + session.expires_in;
        this.remember(session);
        return session.access_token;
      };
      this.refreshing = (globalThis.navigator?.locks ? navigator.locks.request(this.key, refresh) : refresh()).finally(() => { this.refreshing = null; });
      return this.refreshing;
    }
    async read(knownRevision = -1) {
      const token = await this.token(), query = '&user_id=eq.' + encodeURIComponent(this.session.user.id) + '&limit=1';
      const rows = await this.request('/rest/v1/tijian_workspaces?select=revision,updated_at' + query, { token });
      if (!rows.length) return null;
      if (rows[0].revision === knownRevision) return rows[0];
      const full = await this.request('/rest/v1/tijian_workspaces?select=revision,payload,updated_at' + query, { token });
      return full[0] || null;
    }
    async write(expectedRevision, payload) {
      return this.request('/rest/v1/rpc/tijian_save_workspace', { method: 'POST', token: await this.token(), body: { expected_revision: expectedRevision, workspace_payload: payload } });
    }
    async logout() {
      const token = this.session?.access_token;
      this.remember(null);
      if (token) await this.request('/auth/v1/logout?scope=local', { method: 'POST', token }).catch(() => {});
    }
  }

  // The server performs compare-and-swap writes. Conflicts pause synchronization
  // and retain both snapshots instead of silently discarding another device's work.
  class Sync {
    constructor(options) { Object.assign(this, options); this.serial = 0; this.conflict = null; this.status = 'idle'; this.message = ''; }
    setStatus(status, message = '') { this.status = status; this.message = message; this.onStatus?.(); }
    changed() { this.serial++; const meta = this.getMeta(); if (this.client.session?.user.id === meta.userId) meta.dirty = true; this.schedule(); }
    schedule(delay = 900) { clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), delay); }
    async pause(remote, message) {
      if (!remote?.payload) throw new CloudError('云端数据不完整，请稍后重试。');
      this.validate(remote.payload);
      await this.archive(this.getState(), remote.payload);
      this.conflict = { remote, message };
      this.setStatus('conflict', message);
    }
    run() {
      if (this.running) { this.again = true; return this.running; }
      if (this.stopped || !this.client.session || this.conflict) return Promise.resolve();
      this.running = this.sync().catch(error => {
        this.setStatus(error.code === 'network' ? 'offline' : error.code === 'auth' ? 'auth' : 'error', error.message);
        if (error.code === 'auth') this.onAuthRequired?.();
      }).finally(() => {
        this.running = null;
        if (this.again) { this.again = false; this.schedule(); }
      });
      return this.running;
    }
    async sync() {
      const userId = this.client.session.user.id, serial = this.serial;
      const initial = this.getMeta().userId !== userId;
      this.setStatus('syncing');
      const remote = await this.client.read(initial ? -1 : this.getMeta().revision || 0);
      if (!this.client.session || this.client.session.user.id !== userId) return;
      if (serial !== this.serial) { this.again = true; return; }
      const meta = this.getMeta(), revision = remote?.revision || 0;
      if (initial && remote && this.hasLocalData()) return this.pause(remote, '这台设备和云端都有学习数据，请选择要继续使用的一份。两份数据已留存备份。');
      if (!initial && meta.dirty && revision !== (meta.revision || 0)) {
        if (remote) return this.pause(remote, '其他设备和本机都更新了学习数据。同步已暂停，两份数据已留存备份。');
      }
      if (remote && (initial || revision !== meta.revision)) {
        if (!this.canApply()) return this.setStatus('remote', '其他设备有更新，返回题库后会同步。');
        this.validate(remote.payload);
        await this.apply(remote.payload, { userId, revision, dirty: false, syncedAt: remote.updated_at });
        return this.setStatus('synced');
      }
      if (initial || !remote) Object.assign(meta, { userId, revision: 0, dirty: true });
      if (!meta.dirty) return this.setStatus('synced');
      const payload = copy(this.getState()), beforeWrite = this.serial;
      this.validate(payload);
      const result = await this.client.write(meta.revision || 0, payload);
      if (!result.ok) return this.pause(result, '其他设备刚刚更新了数据。两份记录已保留，请选择继续使用的一份。');
      Object.assign(meta, { userId, revision: result.revision, dirty: beforeWrite !== this.serial, syncedAt: result.updated_at });
      await this.persist();
      this.setStatus(meta.dirty ? 'pending' : 'synced');
      if (meta.dirty) this.again = true;
    }
    async resolve(choice) {
      if (this.running || !this.conflict) return;
      this.setStatus('syncing');
      try {
        const remote = await this.client.read(-1);
        if (remote) this.validate(remote.payload);
        await this.archive(this.getState(), remote?.payload);
        if (choice === 'remote') {
          if (!remote) throw new CloudError('云端记录已变化，请重新同步后再选择。');
          await this.apply(remote.payload, { userId: this.client.session.user.id, revision: remote.revision, dirty: false, syncedAt: remote.updated_at });
        } else {
          const serial = this.serial, payload = copy(this.getState()); this.validate(payload);
          const result = await this.client.write(remote?.revision || 0, payload);
          if (!result.ok) { await this.pause(result, '云端又有更新，请重新选择。'); return; }
          Object.assign(this.getMeta(), { userId: this.client.session.user.id, revision: result.revision, dirty: serial !== this.serial, syncedAt: result.updated_at });
          await this.persist();
        }
        this.conflict = null;
        this.setStatus(this.getMeta().dirty ? 'pending' : 'synced');
        if (this.getMeta().dirty) this.schedule();
      } catch (error) { this.setStatus('conflict', error.message); }
    }
    stop() { clearTimeout(this.timer); this.stopped = true; this.conflict = null; }
  }
  return { Client, Sync, CloudError };
});
