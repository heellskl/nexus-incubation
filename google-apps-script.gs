/**
 * Приём заявок с лендинга Nexus Incubation Program в Google Таблицу.
 *
 * 1. Создайте Google Таблицу → Расширения → Apps Script.
 * 2. Вставьте этот код и сохраните.
 * 3. Развернуть → Новое развертывание → тип «Веб-приложение»,
 *    «Выполнять от имени»: я, «У кого есть доступ»: все.
 * 4. Скопируйте URL веб-приложения и вставьте его в nexus-landing.html:
 *    CONFIG.SUBMIT_URL = 'https://script.google.com/macros/s/.../exec'
 *
 * Каждая роль попадает на отдельный лист (Волонтёр, Спикер, Ментор, Трекер).
 */
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(data.role) || ss.insertSheet(data.role);

  var keys = Object.keys(data);
  if (sheet.getLastRow() === 0) sheet.appendRow(keys);
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  keys.forEach(function (k) {
    if (header.indexOf(k) === -1) {
      header.push(k);
      sheet.getRange(1, header.length).setValue(k);
    }
  });

  var row = header.map(function (k) {
    var v = data[k];
    return Array.isArray(v) ? v.join(', ') : (v === undefined ? '' : v);
  });
  sheet.appendRow(row);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
