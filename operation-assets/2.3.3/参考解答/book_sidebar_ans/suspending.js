$(function () {
	$('.float').css('left', '-262px');
	var expanded = false;
	$('.bar').click(function () {
		if (expanded) {
			// 展开状态变隐藏状态
			$('.float').animate({ 'left': '-262px' }, 500);
			$('.bar').css("background-position", "0px 0px");
		} else {
			// 隐藏状态变展开状态
			$('.float').animate({ 'left': '0px' }, 500);
			$('.bar').css("background-position", "-25px 0px");
		}
		expanded = !expanded;
	});
});

