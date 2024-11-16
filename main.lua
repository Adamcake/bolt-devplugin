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
  if capturing then
    local browser = bolt.createbrowser(1000, 750, string.format("file://app/index.html?n=%s", tostring(captureestimate)))
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
  captureestimate = captureestimate + event:vertexcount()
  if not capturing then return end
  -- send all the details to the browser using capturebrowser:sendmessage
  -- remember to differentiate between normal UI and the minimap by checking event:isminimap()
end)

bolt.onrender3d(function (event)
  captureestimate = captureestimate + event:vertexcount()
  if not capturing then return end

  local vertexcount = event:vertexcount()
  local animated = event:animated()
  local animations = {}
  local animationcount = 0
  local mm1,  mm2,  mm3,  mm4,
        mm5,  mm6,  mm7,  mm8,
        mm9,  mm10, mm11, mm12,
        mm13, mm14, mm15, mm16 = event:modelmatrix():get()
  local pm1,  pm2,  pm3,  pm4,
        pm5,  pm6,  pm7,  pm8,
        pm9,  pm10, pm11, pm12,
        pm13, pm14, pm15, pm16 = event:viewprojmatrix():get()
  
  for i = 1, vertexcount do
    local atlasmeta = event:vertexmeta(i)
    local bone = event:vertexbone(i)
    if animated and animations[bone] == nil then
      animations[bone] = event:boneanimation(bone)
      animationcount = animationcount + 1
    end
  end

  local messagesize = 16 + (16 * 8 * 2) + (vertexcount * 64) + (136 * animationcount)
  local message = bolt.createbuffer(messagesize)
  if event:animated() then
    message:setuint8(0, 2)
  else
    message:setuint8(0, 1)
  end
  message:setuint32(4, vertexcount)
  message:setuint32(12, animationcount)
  message:setfloat64(16, mm1)
  message:setfloat64(24, mm2)
  message:setfloat64(32, mm3)
  message:setfloat64(40, mm4)
  message:setfloat64(48, mm5)
  message:setfloat64(56, mm6)
  message:setfloat64(64, mm7)
  message:setfloat64(72, mm8)
  message:setfloat64(80, mm9)
  message:setfloat64(88, mm10)
  message:setfloat64(96, mm11)
  message:setfloat64(104, mm12)
  message:setfloat64(112, mm13)
  message:setfloat64(120, mm14)
  message:setfloat64(128, mm15)
  message:setfloat64(136, mm16)
  message:setfloat64(144, pm1)
  message:setfloat64(152, pm2)
  message:setfloat64(160, pm3)
  message:setfloat64(168, pm4)
  message:setfloat64(176, pm5)
  message:setfloat64(184, pm6)
  message:setfloat64(192, pm7)
  message:setfloat64(200, pm8)
  message:setfloat64(208, pm9)
  message:setfloat64(216, pm10)
  message:setfloat64(224, pm11)
  message:setfloat64(232, pm12)
  message:setfloat64(240, pm13)
  message:setfloat64(248, pm14)
  message:setfloat64(256, pm15)
  message:setfloat64(264, pm16)
  local cursor = 272

  for i = 1, vertexcount do
    local x, y, z = event:vertexxyz(i):get()
    local bone = event:vertexbone(i)
    local atlasmeta = event:vertexmeta(i)
    local u, v = event:vertexuv(i)
    local cr, cg, cb, ca = event:vertexcolour(i)
    local imgx, imgy, imgw, imgh = event:atlasxywh(atlasmeta)
    message:setint16(cursor, x)
    message:setint16(cursor + 2, y)
    message:setint16(cursor + 4, z)
    message:setint16(cursor + 6, bone)
    message:setfloat64(cursor + 8, u)
    message:setfloat64(cursor + 16, v)
    message:setuint16(cursor + 24, imgw)
    message:setuint16(cursor + 26, imgh)
    message:setuint16(cursor + 28, imgw)
    message:setuint16(cursor + 30, imgh)
    message:setfloat64(cursor + 32, cr)
    message:setfloat64(cursor + 40, cg)
    message:setfloat64(cursor + 48, cb)
    message:setfloat64(cursor + 56, ca)
    cursor = cursor + 64
  end
  for bone, transform in pairs(animations) do
    local t1,  t2,  t3,  t4,
          t5,  t6,  t7,  t8,
          t9,  t10, t11, t12,
          t13, t14, t15, t16 = transform:get()
    message:setuint16(cursor, bone)
    -- 6 unused bytes
    message:setfloat64(cursor + 8, t1)
    message:setfloat64(cursor + 16, t2)
    message:setfloat64(cursor + 24, t3)
    message:setfloat64(cursor + 32, t4)
    message:setfloat64(cursor + 40, t5)
    message:setfloat64(cursor + 48, t6)
    message:setfloat64(cursor + 56, t7)
    message:setfloat64(cursor + 64, t8)
    message:setfloat64(cursor + 72, t9)
    message:setfloat64(cursor + 80, t10)
    message:setfloat64(cursor + 88, t11)
    message:setfloat64(cursor + 96, t12)
    message:setfloat64(cursor + 104, t13)
    message:setfloat64(cursor + 112, t14)
    message:setfloat64(cursor + 120, t15)
    message:setfloat64(cursor + 128, t16)
    cursor = cursor + 136
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
