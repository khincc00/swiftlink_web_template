document.addEventListener('DOMContentLoaded', function () {
  var year = document.getElementById('year');
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  var printButton = document.getElementById('print-button');
  if (printButton) {
    printButton.addEventListener('click', function () {
      window.print();
    });
  }
});
