local bolt = require("bolt")
bolt.checkversion(1, 0)

local cfgname = "config.ini"
local buttonwidth = 120
local buttonheight = 40
local capturebuttonwindow
local capturebuttondragminimum = 4
local capturebuttonheld = false
local capturebuttonclickx, capturebuttonclicky
local capturepending = false
local capturing = false
local capturetextures = {}
local capturebrowser
local captureestimate = 0
local cfg = {}

(function ()
  local cfgstring = bolt.loadconfig(cfgname)
  if cfgstring ~= nil then
    for k, v in string.gmatch(cfgstring, "(%w+)=(%w+)") do
      cfg[k] = v
    end
  end
end)()

local function saveconfig ()
  local cfgstring = ""
  for k, v in pairs(cfg) do
    cfgstring = string.format("%s%s=%s\n", cfgstring, k, tostring(v))
  end
  bolt.saveconfig(cfgname, cfgstring)
end

local function setbuffermatrix (buffer, offset, transform)
  local m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15, m16 = transform:get()
  buffer:setfloat32(offset, m1)
  buffer:setfloat32(offset + 4, m2)
  buffer:setfloat32(offset + 8, m3)
  buffer:setfloat32(offset + 12, m4)
  buffer:setfloat32(offset + 16, m5)
  buffer:setfloat32(offset + 20, m6)
  buffer:setfloat32(offset + 24, m7)
  buffer:setfloat32(offset + 28, m8)
  buffer:setfloat32(offset + 32, m9)
  buffer:setfloat32(offset + 36, m10)
  buffer:setfloat32(offset + 40, m11)
  buffer:setfloat32(offset + 44, m12)
  buffer:setfloat32(offset + 48, m13)
  buffer:setfloat32(offset + 52, m14)
  buffer:setfloat32(offset + 56, m15)
  buffer:setfloat32(offset + 60, m16)
end

local function sendtexture (event)
  local textureid = event:textureid()
  if capturetextures[textureid] == nil then
    capturetextures[textureid] = true
    local w, h = event:texturesize()
    local message = bolt.createbuffer(16 + (w * h * 4))
    message:setuint8(0, 1)
    message:setuint32(4, textureid)
    message:setuint32(8, w)
    message:setuint32(12, h)
    for i = 1, h do
      message:setstring(16 + (w * 4 * (i - 1)), event:texturedata(0, i - 1, w * 4))
    end
    capturebrowser:sendmessage(message)
  end
end

capturebuttonwindow = bolt.createwindow(cfg.buttonx or 20, cfg.buttony or 20, buttonwidth, buttonheight)

bolt.onswapbuffers(function (event)
  if capturing then
    capturebrowser:sendmessage("\x00\x00\x00\x00")
  end
  capturing = capturepending
  capturepending = false
  capturetextures = {}
  local windoww, windowh = bolt.gamewindowsize()
  local gvx, gvy, gvw, gvh = bolt.gameviewxywh()
  if capturing then
    local url = string.format(
      "file://app/index.html?n=%s&w=%s&h=%s&gx=%s&gy=%s&gw=%s&gh=%s",
      tostring(captureestimate),
      tostring(windoww),
      tostring(windowh),
      tostring(gvx),
      tostring(gvy),
      tostring(gvw),
      tostring(gvh)
    )
    local browser = bolt.createbrowser(windoww, windowh, url)
    browser:showdevtools()
    browser:oncloserequest(function ()
      browser:close()
    end)
    browser:onmessage(function (message)
      print(string.format("plugin: message received: %s", message))
    end)
    capturebrowser = browser
  end
  captureestimate = 0
end)

local function send2d(event, id)
  if event:verticesperimage() ~= 6 then
    return
  end

  sendtexture(event)

  local vertexcount = event:vertexcount()
  local textureid = event:textureid()
  local targetw, targeth = event:targetsize()
  local messagesize = 16 + (vertexcount * 40)
  local message = bolt.createbuffer(messagesize)
  message:setuint8(0, id)
  message:setuint32(4, vertexcount)
  message:setuint32(8, textureid)
  message:setuint16(12, targetw)
  message:setuint16(14, targeth)
  local cursor = 16
  for i = 1, vertexcount do
    local x, y = event:vertexxy(i)
    local ax, ay, aw, ah, wrapx, wrapy = event:vertexatlasdetails(i)
    local u, v = event:vertexuv(i)
    local r, g, b, a = event:vertexcolour(i)
    local discard = u == nil or v == nil
    message:setint16(cursor, x)
    message:setint16(cursor + 2, y)
    message:setint16(cursor + 4, ax)
    message:setint16(cursor + 6, ay)
    message:setint16(cursor + 8, aw)
    message:setint16(cursor + 10, ah)
    message:setuint8(cursor + 12, discard and 1 or 0)
    message:setuint8(cursor + 13, wrapx and 1 or 0)
    message:setuint8(cursor + 14, wrapy and 1 or 0)    
    -- 1 unused byte
    if not discard then
      message:setfloat32(cursor + 16, u)
      message:setfloat32(cursor + 20, v)
    end
    message:setfloat32(cursor + 24, r)
    message:setfloat32(cursor + 28, g)
    message:setfloat32(cursor + 32, b)
    message:setfloat32(cursor + 36, a)
    cursor = cursor + 40
  end
  capturebrowser:sendmessage(message)
end

bolt.onrender2d(function (event)
  local vertexcount = event:vertexcount()
  captureestimate = captureestimate + vertexcount
  if not capturing then return end
  send2d(event, 4)
end)

bolt.onrender3d(function (event)
  local vertexcount = event:vertexcount()
  captureestimate = captureestimate + vertexcount
  if not capturing then return end

  local animated = event:animated()
  local textureid = event:textureid()

  sendtexture(event)

  local vertexmsgsize = 56
  if animated then
    vertexmsgsize = 120
  end
  local messagesize = 144 + (vertexcount * vertexmsgsize)
  local message = bolt.createbuffer(messagesize)
  if animated then
    message:setuint8(0, 3)
  else
    message:setuint8(0, 2)
  end
  message:setuint32(4, vertexcount)
  message:setuint32(8, textureid)
  -- 4 unused bytes
  setbuffermatrix(message, 16, event:modelmatrix())
  setbuffermatrix(message, 80, event:viewmatrix())
  local cursor = 144

  for i = 1, vertexcount do
    local x, y, z = event:vertexpoint(i):get()
    local atlasmeta = event:vertexmeta(i)
    local u, v = event:vertexuv(i)
    local cr, cg, cb, ca = event:vertexcolour(i)
    local imgx, imgy, imgw, imgh = event:atlasxywh(atlasmeta)
    message:setfloat32(cursor     , x)
    message:setfloat32(cursor +  4, y)
    message:setfloat32(cursor +  8, z)
    -- 4 unused bytes
    message:setfloat32(cursor + 16, u)
    message:setfloat32(cursor + 20, v)
    message:setfloat32(cursor + 24, imgx)
    message:setfloat32(cursor + 28, imgy)
    message:setfloat32(cursor + 32, imgw)
    message:setfloat32(cursor + 36, imgh)
    message:setfloat32(cursor + 40, cr)
    message:setfloat32(cursor + 44, cg)
    message:setfloat32(cursor + 48, cb)
    message:setfloat32(cursor + 52, ca)
    if animated then
      setbuffermatrix(message, cursor + 56, event:vertexanimation(i))
    end
    cursor = cursor + vertexmsgsize
  end
  capturebrowser:sendmessage(message)
end)

bolt.onrendericon(function (event)
  local modelcount = event:modelcount()
  for i = 1, modelcount do
    captureestimate = captureestimate + event:modelvertexcount(i)
  end
  if not capturing then return end

  local x, y, w, h = event:xywh()
  local modelcount = event:modelcount()

  local messagesize = 16 + (modelcount * 132)
  for i = 1, modelcount do
    local vertexcount = event:modelvertexcount(i)
    messagesize = messagesize + (vertexcount * 24)
  end
  local message = bolt.createbuffer(messagesize)
  message:setuint8(0, 5)
  message:setint16(4, x)
  message:setint16(6, y)
  message:setint16(8, w)
  message:setint16(10, h)
  message:setuint32(12, modelcount)
  cursor = 16

  for model = 1, modelcount do
    local vertexcount = event:modelvertexcount(model)
    message:setuint32(cursor, vertexcount)
    setbuffermatrix(message, cursor + 4, event:modelviewmatrix(model))
    setbuffermatrix(message, cursor + 68, event:modelprojectionmatrix(model))
    cursor = cursor + 132
    for vertex = 1, vertexcount do
      local vx, vy, vz = event:modelvertexpoint(model, vertex):get()
      local vr, vg, vb, va = event:modelvertexcolour(model, vertex)
      message:setint16(cursor, vx)
      message:setint16(cursor + 2, vy)
      message:setint16(cursor + 4, vz)
      -- 2 unused bytes
      message:setfloat32(cursor + 8, vr)
      message:setfloat32(cursor + 12, vg)
      message:setfloat32(cursor + 16, vb)
      message:setfloat32(cursor + 20, va)
      cursor = cursor + 24
    end
  end
  capturebrowser:sendmessage(message)
end)

bolt.onminimaprender2d(function (event)
  local vertexcount = event:vertexcount()
  captureestimate = captureestimate + vertexcount
  if not capturing then return end
  send2d(event, 6)
end)

bolt.onrenderminimap(function (event)
  if not capturing then return end
  local sx, sy, sw, sh = event:sourcexywh()
  local tx, ty, tw, th = event:targetxywh()
  local message = bolt.createbuffer(20)
  message:setuint8(0, 7)
  message:setint16(4, sx)
  message:setint16(6, sy)
  message:setuint16(8, sw)
  message:setuint16(10, sh)
  message:setint16(12, tx)
  message:setint16(14, ty)
  message:setuint16(16, tw)
  message:setuint16(18, th)
  capturebrowser:sendmessage(message)
end)

capturebuttonwindow:clear(252.0/255.0, 63.0/255.0, 63.0/255.0)
capturebuttonwindow:onmousebutton(function (event)
  if event:button() ~= 1 then return end
  capturebuttonclickx, capturebuttonclicky = event:xy()
  capturebuttonheld = true
end)
capturebuttonwindow:onmousebuttonup(function (event)
  if event:button() ~= 1 then return end
  if not capturebuttonheld then return end
  capturebuttonheld = false
  local x, y = event:xy()
  if (math.abs(x - capturebuttonclickx) < capturebuttondragminimum) and (math.abs(y - capturebuttonclicky) < capturebuttondragminimum) then
    capturepending = true
  end  
end)
capturebuttonwindow:onmousemotion(function (event)
  if not capturebuttonheld then return end
  local x, y = event:xy()
  if (math.abs(x - capturebuttonclickx) >= capturebuttondragminimum) or (math.abs(y - capturebuttonclicky) >= capturebuttondragminimum) then
    capturebuttonwindow:startreposition(0, 0)
  end
end)
capturebuttonwindow:onreposition(function (event)
  if event:didresize() then
    bolt.close()
  else
    local x, y, w, h = event:xywh()
    cfg.buttonx = x
    cfg.buttony = y
    capturebuttonheld = false
    saveconfig()
  end
end)
