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

bolt.onrender2d(function (event)
  local vertexcount = event:vertexcount()
  captureestimate = captureestimate + vertexcount
  if not capturing then return end

  if event:verticesperimage() ~= 6 then
    return
  end
  
  if event:isminimap() then
    -- todo
    return
  end

  local vertexcount = event:vertexcount()
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

  local messagesize = 16 + (vertexcount * 48)
  local message = bolt.createbuffer(messagesize)
  message:setuint8(0, 4)
  message:setuint32(4, vertexcount)
  message:setuint32(8, textureid)
  -- 4 unused bytes
  local cursor = 16
  for i = 1, vertexcount do
    local x, y = event:vertexxy(i)
    local ax, ay = event:vertexatlasxy(i)
    local aw, ah = event:vertexatlaswh(i)
    local u, v = event:vertexuv(i)
    local r, g, b, a = event:vertexcolour(i)
    message:setfloat32(cursor, x)
    message:setfloat32(cursor + 4, y)
    message:setfloat32(cursor + 8, u)
    message:setfloat32(cursor + 12, v)
    message:setfloat32(cursor + 16, ax)
    message:setfloat32(cursor + 20, ay)
    message:setfloat32(cursor + 24, aw)
    message:setfloat32(cursor + 28, ah)
    message:setfloat32(cursor + 32, r)
    message:setfloat32(cursor + 36, g)
    message:setfloat32(cursor + 40, b)
    message:setfloat32(cursor + 44, a)
    cursor = cursor + 48
  end
  capturebrowser:sendmessage(message)
end)

bolt.onrender3d(function (event)
  local vertexcount = event:vertexcount()
  captureestimate = captureestimate + vertexcount
  if not capturing then return end

  local animated = event:animated()
  local textureid = event:textureid()
  local animations = {}
  local animationcount = 0
  local mm1,  mm2,  mm3,  mm4,
        mm5,  mm6,  mm7,  mm8,
        mm9,  mm10, mm11, mm12,
        mm13, mm14, mm15, mm16 = event:modelmatrix():get()
  local vm1,  vm2,  vm3,  vm4,
        vm5,  vm6,  vm7,  vm8,
        vm9,  vm10, vm11, vm12,
        vm13, vm14, vm15, vm16 = event:viewmatrix():get()
  
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
  message:setfloat32(16, mm1)
  message:setfloat32(20, mm2)
  message:setfloat32(24, mm3)
  message:setfloat32(28, mm4)
  message:setfloat32(32, mm5)
  message:setfloat32(36, mm6)
  message:setfloat32(40, mm7)
  message:setfloat32(44, mm8)
  message:setfloat32(48, mm9)
  message:setfloat32(52, mm10)
  message:setfloat32(56, mm11)
  message:setfloat32(60, mm12)
  message:setfloat32(64, mm13)
  message:setfloat32(68, mm14)
  message:setfloat32(72, mm15)
  message:setfloat32(76, mm16)
  message:setfloat32(80, vm1)
  message:setfloat32(84, vm2)
  message:setfloat32(88, vm3)
  message:setfloat32(92, vm4)
  message:setfloat32(96, vm5)
  message:setfloat32(100, vm6)
  message:setfloat32(104, vm7)
  message:setfloat32(108, vm8)
  message:setfloat32(112, vm9)
  message:setfloat32(116, vm10)
  message:setfloat32(120, vm11)
  message:setfloat32(124, vm12)
  message:setfloat32(128, vm13)
  message:setfloat32(132, vm14)
  message:setfloat32(136, vm15)
  message:setfloat32(140, vm16)
  local cursor = 144

  for i = 1, vertexcount do
    local x, y, z = event:vertexxyz(i):get()
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
      local tm1,  tm2,  tm3,  tm4,
            tm5,  tm6,  tm7,  tm8,
            tm9,  tm10, tm11, tm12,
            tm13, tm14, tm15, tm16 = event:vertexanimation(i):get()
      message:setfloat32(cursor + 56, tm1)
      message:setfloat32(cursor + 60, tm2)
      message:setfloat32(cursor + 64, tm3)
      message:setfloat32(cursor + 68, tm4)
      message:setfloat32(cursor + 72, tm5)
      message:setfloat32(cursor + 76, tm6)
      message:setfloat32(cursor + 80, tm7)
      message:setfloat32(cursor + 84, tm8)
      message:setfloat32(cursor + 88, tm9)
      message:setfloat32(cursor + 92, tm10)
      message:setfloat32(cursor + 96, tm11)
      message:setfloat32(cursor + 100, tm12)
      message:setfloat32(cursor + 104, tm13)
      message:setfloat32(cursor + 108, tm14)
      message:setfloat32(cursor + 112, tm15)
      message:setfloat32(cursor + 116, tm16)
    end
    cursor = cursor + vertexmsgsize
  end
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
