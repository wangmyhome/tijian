$(document).ready(function () {
	// 构造三个分隔层，从下至上依次为.bg,.out,.over

	var titles = $("#menu1 li a");
	for (let index = 0; index < titles.length; index++) {
		const element = titles.eq(index);
		const text = element.text();
		var newhtml = `
			<span class='out'>${text}</span>
			<span class='bg'></span>
			<span class='over'>${text}</span>
			`;

		//element.empty().append(newhtml);
		//or
		element.html(newhtml);
	}

	$("#menu1 li a").hover(function () {
		// .out隐藏
		$(this).children(".out").animate({ "top": "-40px" }, 250);
		// .over显示

		$(this).children(".over").animate({ "top": "0px" }, 250);
		// .bg 显示 

		$(this).children(".bg").animate({ "top": "0px" }, 120);

	}, function () {
		// .out显示
		$(this).children(".out").animate({ "top": "0px" }, 250);
		// .over隐藏

		$(this).children(".over").animate({ "top": "-40px" }, 250);
		// .bg 隐藏

		$(this).children(".bg").animate({ "top": "-40px" }, 120);
	});
});
