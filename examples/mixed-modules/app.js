goog.provide('app');

goog.require('app.script1');
goog.require('goog.ui.DatePicker');

goog.scope(() => {
  document.getElementById('output').textContent = app.script1;
  const datePicker = new goog.ui.DatePicker();
  datePicker.render(document.getElementById('datepicker'));
});
