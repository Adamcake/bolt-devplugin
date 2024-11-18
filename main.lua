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
  local textureid = event:textureid()
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
  
  for i = 1, vertexcount do
    local atlasmeta = event:vertexmeta(i)
    local bone = event:vertexbone(i)
    if animated and animations[bone] == nil then
      animations[bone] = event:boneanimation(bone)
      animationcount = animationcount + 1
    end
  end

  local messagesize = 144 + (vertexcount * 56) + (72 * animationcount)
  local message = bolt.createbuffer(messagesize)
  if event:animated() then
    message:setuint8(0, 3)
  else
    message:setuint8(0, 2)
  end
  message:setuint32(4, vertexcount)
  message:setuint32(8, textureid)
  message:setuint32(12, animationcount)
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
  message:setfloat32(80, pm1)
  message:setfloat32(84, pm2)
  message:setfloat32(88, pm3)
  message:setfloat32(92, pm4)
  message:setfloat32(96, pm5)
  message:setfloat32(100, pm6)
  message:setfloat32(104, pm7)
  message:setfloat32(108, pm8)
  message:setfloat32(112, pm9)
  message:setfloat32(116, pm10)
  message:setfloat32(120, pm11)
  message:setfloat32(124, pm12)
  message:setfloat32(128, pm13)
  message:setfloat32(132, pm14)
  message:setfloat32(136, pm15)
  message:setfloat32(140, pm16)
  local cursor = 144

  for i = 1, vertexcount do
    local x, y, z = event:vertexxyz(i):get()
    local bone = event:vertexbone(i)
    local atlasmeta = event:vertexmeta(i)
    local u, v = event:vertexuv(i)
    local cr, cg, cb, ca = event:vertexcolour(i)
    local imgx, imgy, imgw, imgh = event:atlasxywh(atlasmeta)
    message:setfloat32(cursor     , x)
    message:setfloat32(cursor +  4, y)
    message:setfloat32(cursor +  8, z)
    message:setfloat32(cursor + 12, bone)
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
    cursor = cursor + 56
  end
  for bone, transform in pairs(animations) do
    local t1,  t2,  t3,  t4,
          t5,  t6,  t7,  t8,
          t9,  t10, t11, t12,
          t13, t14, t15, t16 = transform:get()
    message:setuint16(cursor, bone)
    -- 6 unused bytes
    message:setfloat32(cursor + 8, t1)
    message:setfloat32(cursor + 12, t2)
    message:setfloat32(cursor + 16, t3)
    message:setfloat32(cursor + 20, t4)
    message:setfloat32(cursor + 24, t5)
    message:setfloat32(cursor + 28, t6)
    message:setfloat32(cursor + 32, t7)
    message:setfloat32(cursor + 36, t8)
    message:setfloat32(cursor + 40, t9)
    message:setfloat32(cursor + 44, t10)
    message:setfloat32(cursor + 48, t11)
    message:setfloat32(cursor + 52, t12)
    message:setfloat32(cursor + 56, t13)
    message:setfloat32(cursor + 60, t14)
    message:setfloat32(cursor + 64, t15)
    message:setfloat32(cursor + 68, t16)
    cursor = cursor + 72
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
