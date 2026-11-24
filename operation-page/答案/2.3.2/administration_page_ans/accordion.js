$('.box>ul>li').on({
  mouseover: function () {

    // 将当前图片项的宽度设置为图片的宽度958px
    $(this).css('width', '958px');
    // 将当前图片项的所有兄弟元素宽度设置为60.5px
    $(this).siblings('li').css('width', '60.5px');
  },
  mouseout: function () {
    // 将所有图片项的宽度设置为240px
    $('.box>ul>li').css('width', '240px');
  }
});