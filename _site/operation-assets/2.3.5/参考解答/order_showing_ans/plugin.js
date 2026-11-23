//插件机制封装多个方法
$.fn.extend({

  //全选 checkAll
  checkAll: function () {
    return this.each(function () {
      this.checked = true;
    });
  },
  //全不选 uncheckAll
  uncheckAll: function () {
    return this.each(function () {
      this.checked = false;
    });
  },
  //反选 checkInvert
  checkInvert: function () {
    return this.each(function () {
      if (this.checked) {
        this.checked = false;
      } else {
        this.checked = true;
      }
    });
  },
});