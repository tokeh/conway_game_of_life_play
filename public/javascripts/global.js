 // create game control
$('.create-game').click(function (e) {
    e.preventDefault();
    $.post($(this).attr('href'), {}, function (data) {
        window.location = data.gameUrl; 
    });
});
