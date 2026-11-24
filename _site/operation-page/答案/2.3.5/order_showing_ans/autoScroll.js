
// function autoScroll(obj) {
// 	//编写autoScroll方法，实现逐行滚动操作
// 	var items = $("#s1>ul>li");
// 	var count = items.length;
// 	var showWhich = obj % count; // 将要显示哪个元素（% count为限制在0 ~ count-1范围内）
// 	var hideWhich = showWhich - 1;// 将要隐藏哪个元素
// 	if (hideWhich < 0) { hideWhich = count - 1; }
// 	items.hide();// 先全部隐藏

// 	items.eq(showWhich).show(); // 显示要参与滚动的元素
// 	items.eq(hideWhich).show(); // 显示要参与滚动的元素
// 	items.eq(hideWhich).css("marginTop", "0px");// 要被滚动上去的元素，放在中间
// 	items.eq(showWhich).css("marginTop", "25px");// 要从下面滚动上来的元素，放在下面

// 	items.eq(hideWhich).animate({ "marginTop": "-25px" }, 500);// 中间的滚动到上面
// 	items.eq(showWhich).animate({ "marginTop": "0px" }, 500);// 下面的滚动到中间
// }
// $(document).ready(function () {
// 	//实现每间隔1000ms，实现预订列表滚动一次
// 	var i = 0;
// 	$("#s1>ul").css("position", "relative"); // 设置外层为相对布局
// 	$("#s1>ul>li").css("position", "absolute"); // 设置内层元素为绝对布局
// 	autoScroll(0); // 先初始化滚动一次。可以看看如果注释掉这行会发生什么，在考虑为什么要夹着每一行
// 	setInterval(() => {
// 		autoScroll(++i); // 每秒滚动一次
// 	}, 1000);
// });


//新版答案

function autoScroll() {
	//编写autoScroll方法，实现逐行滚动操作
	var firstItem = $('#s1 ul li:first');
	var itemHeight = firstItem.outerHeight();
	$('#s1 ul').animate({ 'margin-top': -itemHeight + 'px' }, 500, function () {

		// 将被选中的第一个 li 元素移动到 #s1 ul 元素的末尾实现滚动
		firstItem.appendTo('#s1 ul');

		// 重置 margin-top 值
		$(this).css('margin-top', 0);
	});
}


$(document).ready(function () {
	//实现每间隔1000ms，实现预订列表滚动一次
	setInterval(autoScroll, 1000);
});



