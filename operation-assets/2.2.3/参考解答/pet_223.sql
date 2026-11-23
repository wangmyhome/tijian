USE petstore;
/*（1）编写SQL语句，请为lineitem表中的“itemid”列创建外键，
以保证当要删除和更新product表中的商品号时，会自动删除或更新lineitem表中匹配的行。*/
ALTER TABLE lineitem
ADD CONSTRAINT fk_lineitem_product
FOREIGN KEY (itemid) REFERENCES product(productid)
ON DELETE CASCADE
ON UPDATE CASCADE;


/*（2）编写SQL语句，计算lineitem表中每条记录的商品金额。*/
SELECT orderid, itemid, quantity * unitprice AS 金额 
FROM lineitem;


/*（3）编写SQL语句，查询product表中的商品名和档次。档次按价格（unitcost）划分，
1000元以下显示为“低价商品”，1000元到2000元之间显示为“中档商品”，2000元及以上显示为“高档商品”。*/
SELECT name AS 商品名,
       CASE
           WHEN unitcost < 1000 THEN '低价商品'
           WHEN unitcost BETWEEN 1000 AND 2000 THEN '中档商品'
           ELSE '高档商品'
       END AS 档次
FROM product;


/*（4）编写SQL语句，查询account表中女客户的姓名、地址和电话，显示的列标题要求用中文“姓名”、“地址”、“电话”表示。*/
SELECT username AS 姓名, address AS 地址, phone AS 电话
FROM account
WHERE sex = '女';


/*（5）编写SQL语句，查询orders表中订单总价在200~500元区间（包含200和500）的订单信息。*/
SELECT *
FROM orders
WHERE totalprice totalprice>=200 and totalprice<=500;


/*（6）编写SQL语句，显示orders表中单笔订单金额大于等于300元的用户名、订单总价。*/
SELECT a.fullname, o.totalprice 
FROM orders o 
JOIN account a ON o.userid = a.userid 
Where o.totalprice >= 300;


/*（7）编写SQL语句，计算orders表中的成交总额。*/
SELECT SUM(totalprice) AS 成交总额
FROM orders;


/*（8）编写SQL语句，按性别统计客户人数。*/
SELECT sex AS 性别, COUNT(*) AS 客户人数
FROM account
GROUP BY sex;


/*（9）编写SQL语句，显示lineitem表中商品的购买总数量超过2件商品号和购买总数量，并按购买数量从小到大排序。*/
SELECT itemid AS 商品号, SUM(quantity) AS 购买总数量
FROM lineitem
GROUP BY itemid
HAVING SUM(quantity) > 2
ORDER BY 购买总数量 ASC;


/*（10）编写SQL语句，当订单号为“20130411”的订单已经发货后，根据该订单的订单明细表修改商品表的库存。*/
UPDATE lineitem,product  
    SET product.qty= product.qty-lineitem.quantity 
    WHERE lineitem.itemid= product.productid AND lineitem.orderid='20130411';