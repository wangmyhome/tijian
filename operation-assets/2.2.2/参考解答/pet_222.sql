USE petstore;
/*（1）编写SQL语句，请为orders表中的“userid”列创建外键，
以保证当要删除和更新account表中的数据时，
只要orders表中还有该客户的订单，则拒绝account表进行删除和更新操作。*/
ALTER TABLE orders
ADD CONSTRAINT fk_orders_account
FOREIGN KEY (userid) REFERENCES account(userid)
ON DELETE RESTRICT
ON UPDATE RESTRICT;


/*（2）编写SQL语句，当订单号为“20130411”的订单已经发货，请将该订单的状态修改为“1”*/
UPDATE orders 
SET status = '1'
WHERE orderid = '20130411';


/*（3）编写SQL语句，查询lineitem表中的商品号和单价，要求消除重复行。*/
SELECT DISTINCT itemid, unitprice
FROM lineitem;


/*（4）编写SQL语句，查询account表中客户的姓名和性别，要求性别为“男”时显示1，为“女”时显示0。*/
SELECT fullname AS 姓名, 
  CASE 
    WHEN sex = '男' THEN 1 ELSE 0 
  END AS 性别
FROM account;


/*（5）编写SQL语句，查询product表中商品号倒数第4个标号为“W”的商品信息。*/
SELECT * FROM product WHERE productid like '%W___';


/*（6）编写SQL语句，查询lineitem表中的订单号、商品名称和购买数量。*/
SELECT l.orderid, p.name, l.quantity 
FROM lineitem l 
JOIN product p ON l.itemid = p.productid;


/*（7）编写SQL语句，查询“刘晓和”的基本情况和订单情况。*/
SELECT *
FROM account a 
JOIN orders o ON a.userid = o.userid
WHERE a.fullname = '刘晓和';


/*（8）编写SQL语句，统计客户总数。*/
SELECT COUNT(*) AS 客户总数
FROM account;


/*（9）编写SQL语句，按商品类别统计各类商品总数、平均成本单价（unitcost）。*/
SELECT catid AS 商品类别, SUM(qty) AS 商品总数, AVG(unitcost) AS 平均成本单价 
FROM product 
GROUP By catid;


/*（10）编写SQL语句，将orders表按用户从小到大排序，用户号相同的按订单日期从大到小排序。*/
SELECT *
FROM orders
ORDER BY userid ASC, orderdate DESC;