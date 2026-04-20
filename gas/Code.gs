// gas/Code.gs
// 部署方式：GAS 編輯器 → 部署 → 新增部署 → 網路應用程式
//   執行身份：我（你的 Google 帳號）
//   存取權：任何人（包括匿名使用者）
// 注意：每次修改後需重新部署才會生效

function doGet(e) {
  const action = e.parameter.action
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  try {
    let data
    if      (action === 'getConfig')   data = _getConfig(ss, false)
    else if (action === 'getMembers')  data = _getMembers(ss)
    else if (action === 'getSessions') data = _getSessions(ss)
    else return _json({ status: 'error', message: 'Unknown action: ' + action })
    return _json({ status: 'ok', data })
  } catch (err) {
    return _json({ status: 'error', message: err.message })
  }
}

function doPost(e) {
  const body   = JSON.parse(e.postData.contents)
  const action = e.parameter.action
  const ss     = SpreadsheetApp.getActiveSpreadsheet()
  const config = _getConfig(ss, true)
  if (body.admin_token !== config.admin_token) {
    return _json({ status: 'error', message: 'Unauthorized' })
  }
  try {
    let data
    if      (action === 'saveSession')   data = _saveSession(ss, body)
    else if (action === 'deleteSession') data = _deleteSession(ss, body)
    else if (action === 'saveMember')    data = _saveMember(ss, body)
    else if (action === 'promoteGuest')  data = _promoteGuest(ss, body)
    else if (action === 'demoteMember')  data = _demoteMember(ss, body)
    else return _json({ status: 'error', message: 'Unknown action: ' + action })
    return _json({ status: 'ok', data })
  } catch (err) {
    return _json({ status: 'error', message: err.message })
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

// Google Sheets getValues() 回傳的 Date 不一定通過 instanceof Date
// 用 getTime 方法判斷更可靠
function _isDate(val) {
  return val && typeof val.getTime === 'function' && !isNaN(val.getTime())
}

function _formatDate(val) {
  return _isDate(val) ? Utilities.formatDate(val, 'Asia/Taipei', 'yyyy-MM-dd') : String(val)
}

function _formatTime(val) {
  return _isDate(val) ? Utilities.formatDate(val, 'Asia/Taipei', 'HH:mm') : String(val)
}

function _getConfig(ss, includeToken) {
  const rows   = ss.getSheetByName('config').getDataRange().getValues()
  const config = {}
  rows.forEach(function(row) {
    if (row[0]) {
      var val = row[1]
      // Google Sheets 會把時間欄位轉為 Date 物件（epoch 1899-12-30），需轉回 HH:mm
      if (_isDate(val)) {
        val = _formatTime(val)
      }
      config[row[0]] = val
    }
  })
  if (!includeToken) delete config.admin_token
  return config
}

function _getMembers(ss) {
  const rows = ss.getSheetByName('members').getDataRange().getValues()
  return rows.slice(1).map(function(r) {
    return { id: r[0], name: r[1], active: r[2] === true || r[2] === 'TRUE', created_at: String(r[3] || '') }
  })
}

function _getSessions(ss) {
  const sessionRows = ss.getSheetByName('sessions').getDataRange().getValues().slice(1)
  const attRows     = ss.getSheetByName('attendances').getDataRange().getValues().slice(1)

  var sessionMap = {}
  var sessions = sessionRows.map(function(r) {
    var date = _formatDate(r[1])
    var s = { session_id: r[0], date: date, created_at: String(r[2] || ''), note: r[3] || '', attendances: [] }
    sessionMap[r[0]] = s
    return s
  })

  attRows.forEach(function(r) {
    if (sessionMap[r[1]]) {
      sessionMap[r[1]].attendances.push({
        id: r[0], session_id: r[1], member_id: r[2] || null,
        name: r[3], type: r[4], guest_key: r[5] || null, created_at: String(r[6] || '')
      })
    }
  })

  return sessions.sort(function(a, b) { return b.date.localeCompare(a.date) })
}

function _saveSession(ss, body) {
  var date         = body.date
  var attendances  = body.attendances
  var sessSheet    = ss.getSheetByName('sessions')
  var attSheet     = ss.getSheetByName('attendances')

  // 找或建立 session
  var rows      = sessSheet.getDataRange().getValues().slice(1)
  var sessionId = null
  rows.forEach(function(r) {
    var d = _formatDate(r[1])
    if (d === date) sessionId = r[0]
  })
  if (!sessionId) {
    sessionId = 's' + Date.now()
    sessSheet.appendRow([sessionId, date, new Date().toISOString(), ''])
  }

  // 刪除此場次舊出席記錄
  var attData     = attSheet.getDataRange().getValues()
  var toDelete    = []
  for (var i = 1; i < attData.length; i++) {
    if (attData[i][1] === sessionId) toDelete.push(i + 1)
  }
  toDelete.reverse().forEach(function(row) { attSheet.deleteRow(row) })

  // 新增出席記錄
  var now = new Date().toISOString()
  attendances.forEach(function(att) {
    attSheet.appendRow([
      'a' + Date.now() + Math.random().toString(36).slice(2, 5),
      sessionId,
      att.member_id || '',
      att.name,
      att.type,
      att.guest_key || '',
      now
    ])
  })
  return { session_id: sessionId }
}

function _deleteSession(ss, body) {
  var sessionId = body.session_id
  if (!sessionId) throw new Error('Missing session_id')

  var sessSheet = ss.getSheetByName('sessions')
  var attSheet  = ss.getSheetByName('attendances')

  // 刪除出席記錄
  var attData   = attSheet.getDataRange().getValues()
  var toDelete  = []
  for (var i = 1; i < attData.length; i++) {
    if (attData[i][1] === sessionId) toDelete.push(i + 1)
  }
  toDelete.reverse().forEach(function(row) { attSheet.deleteRow(row) })

  // 刪除場次
  var sessData = sessSheet.getDataRange().getValues()
  for (var j = 1; j < sessData.length; j++) {
    if (sessData[j][0] === sessionId) {
      sessSheet.deleteRow(j + 1)
      break
    }
  }

  return { deleted: sessionId }
}

function _saveMember(ss, body) {
  var sheet = ss.getSheetByName('members')
  var data  = sheet.getDataRange().getValues()

  if (body.id) {
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === body.id) {
        if (body.name   !== undefined) sheet.getRange(i + 1, 2).setValue(body.name)
        if (body.active !== undefined) sheet.getRange(i + 1, 3).setValue(body.active)
        return { id: body.id }
      }
    }
  }

  var newId = 'm' + Date.now()
  sheet.appendRow([newId, body.name, true, new Date().toISOString()])
  return { id: newId }
}

function _promoteGuest(ss, body) {
  var sheet   = ss.getSheetByName('attendances')
  var data    = sheet.getDataRange().getValues()
  var updated = 0
  for (var i = 1; i < data.length; i++) {
    if (data[i][5] === body.guest_key && data[i][4] === 'guest') {
      sheet.getRange(i + 1, 3).setValue(body.member_id)
      sheet.getRange(i + 1, 5).setValue('member')
      updated++
    }
  }
  return { updated: updated }
}

function _demoteMember(ss, body) {
  var memberId = body.member_id
  if (!memberId) throw new Error('Missing member_id')

  // 取得成員名稱
  var memSheet = ss.getSheetByName('members')
  var memData  = memSheet.getDataRange().getValues()
  var memberName = null
  var memberRow  = -1
  for (var i = 1; i < memData.length; i++) {
    if (memData[i][0] === memberId) {
      memberName = memData[i][1]
      memberRow  = i + 1
      break
    }
  }
  if (!memberName) throw new Error('Member not found')

  // 產生 guest_key（與前端一致）
  var guest_key = memberName.toLowerCase().replace(/\s+/g, '_') + '_' + new Date().getFullYear()

  // 更新出席記錄：member → guest
  var attSheet = ss.getSheetByName('attendances')
  var attData  = attSheet.getDataRange().getValues()
  var updated  = 0
  for (var j = 1; j < attData.length; j++) {
    if (attData[j][2] === memberId && attData[j][4] === 'member') {
      attSheet.getRange(j + 1, 3).setValue('')        // 清除 member_id
      attSheet.getRange(j + 1, 5).setValue('guest')   // type → guest
      attSheet.getRange(j + 1, 6).setValue(guest_key) // 設定 guest_key
      updated++
    }
  }

  // 刪除成員
  memSheet.deleteRow(memberRow)

  return { deleted: memberId, guest_key: guest_key, updated: updated }
}
