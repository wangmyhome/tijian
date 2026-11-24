
var i = 0;           // 当前显示的广告图索引
var timer = null;    // 定时器
const delay = 1000;    // 广告图自动切换的间隔时间
const width = 958;     // 每张图片的宽度
const speed = 400;     // 动画时间

//开启定时器
function startTimer() {
  if (timer == null) {
    // 设置自动定时切换
    timer = setInterval(carouselPlay, delay);
  }
}

//停止定时器
function stopTimer() {
  if (timer != null) {
    clearInterval(timer);
    timer = null;
  }
}

//轮播切换函数
function carouselPlay() {
  ++i;
  imgChange();//广告图片切换
  dotChange();//圆点样式切换
}


//切换广告图片
function imgChange() {
  //补全功能

  //首先判断范围是否超过
  var adsCount = $(".hot>li").length;
  if (i >= adsCount) {
    i = i % adsCount; // 求余数，相当于将i限定在0...i...adsCount-1中。当然直接i=0也是可以的。
  }
  // 所有的图片都是在同一行的，也就是只要把一整行往左移动就可以挨个显示每一张图片
  // 往左移动一张图片的宽度，就是显示第二张图片，移动两张图片的宽度，就是第三张图片，以此类推
  // left属性是距离左边界的距离，正数向右移动，负数向左移动。


  $(".hot").animate({ "left": (-i * width) + "px" }, 400);
}

// 切换对应的圆点
function dotChange() {
  // 先全部移除on类，然后给对应的加上。
  $(".dot>li").removeClass("on");
  $(".dot>li").eq(i).addClass("on");
}



$(function () {
  //设置ul的长度，主要目的就是让5张广告图在一行显示
  $('.hot').width($('.hot li').length * width);
  startTimer();//启动定时器

  // 实现鼠标移入，暂停自动播放且左右箭头显示，移出，开始自动播放且左右箭头隐藏
  $(".banner").mouseover(function () {
    $('.arrow').show();
    stopTimer();
  })
  $(".banner").mouseout(function () {
    $('.arrow').hide();
    startTimer();
  })

  //鼠标移入小圆点处，动画切换至对应图片位置且圆点样式同步更新
  var dotCount = $(".dot>li").length;
  for (let j = 0; j < dotCount; j++) {
    const innerJ = j; // 固定作用域变量。j在循环的过程中会一直变化，因此需要有一个不变的变量给下面的内部函数调用。
    $(".dot>li").eq(j).mouseover(function () {
      i = innerJ;
      imgChange();
      dotChange();
    })
  }

  //左箭头按钮功能
  $('.prev').click(function () {
    i--;
    if (i < 0) {
      var adsCount = $(".hot>li").length;
      i = adsCount - 1;
    }
    imgChange();
    dotChange();

  });

  //右箭头按钮功能
  $('.next').click(function () {
    i++;
    imgChange();
    dotChange();
  });

});




