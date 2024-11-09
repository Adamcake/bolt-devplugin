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
  capturing = capturepending
  capturepending = false
  if capturing then
    local browser = bolt.createbrowser(1000, 750, "file://app/index.html")
    browser:showdevtools()
    browser:oncloserequest(function ()
      browser:close()
    end)
    browser:onmessage(function (message)
      print(string.format("plugin: message received: %s", message))
    end)
    capturebrowser = browser
  end
end)

bolt.onrender2d(function (event)
  if not capturing then return end
  -- send all the details to the browser using capturebrowser:sendmessage
  -- remember to differentiate between normal UI and the minimap by checking event:isminimap()
end)

bolt.onrender3d(function (event)
  if not capturing then return end

  local vertexcount = event:vertexcount()
  local animated = event:animated()
  local images = {}
  local imagecount = 0
  local rgbabytesinmessage = 0
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
    if images[atlasmeta] == nil then
      local imgx, imgy, imgw, imgh = event:atlasxywh(atlasmeta)
      local rgba = bolt.createbuffer(imgw * imgh * 4)
      for j = 0, (imgh - 1) do
        local pixelrow = event:texturedata(imgx, imgy + j, imgw * 4)
        rgba:writestring(pixelrow, j * imgw * 4)
      end
      images[atlasmeta] = rgba
      imagecount = imagecount + 1
      rgbabytesinmessage = rgbabytesinmessage + (imgw * imgh * 4)
    end
    if animated and animations[bone] == nil then
      animations[bone] = event:boneanimation(bone)
      animationcount = animationcount + 1
    end
  end

  local messagesize = 16 + (16 * 8 * 2) + (vertexcount * 64) + (imagecount * 8) + rgbabytesinmessage + (16 * 8 * animationcount) + (8 * animationcount)
  local message = bolt.createbuffer(messagesize)
  message:writestring("r3d", 0)
  if event:animated() then
    message:writeinteger(1, 3, 1)
  else
    message:writeinteger(0, 3, 1)
  end
  message:writeinteger(event:animated() and 1 or 0, 3, 1)
  message:writeinteger(vertexcount, 4, 4)
  message:writeinteger(imagecount, 8, 4)
  message:writeinteger(animationcount, 12, 4)
  message:writenumber(mm1, 16)
  message:writenumber(mm2, 24)
  message:writenumber(mm3, 32)
  message:writenumber(mm4, 40)
  message:writenumber(mm5, 48)
  message:writenumber(mm6, 56)
  message:writenumber(mm7, 64)
  message:writenumber(mm8, 72)
  message:writenumber(mm9, 80)
  message:writenumber(mm10, 88)
  message:writenumber(mm11, 96)
  message:writenumber(mm12, 104)
  message:writenumber(mm13, 112)
  message:writenumber(mm14, 120)
  message:writenumber(mm15, 128)
  message:writenumber(mm16, 136)
  message:writenumber(pm1, 144)
  message:writenumber(pm2, 152)
  message:writenumber(pm3, 160)
  message:writenumber(pm4, 168)
  message:writenumber(pm5, 176)
  message:writenumber(pm6, 184)
  message:writenumber(pm7, 192)
  message:writenumber(pm8, 200)
  message:writenumber(pm9, 208)
  message:writenumber(pm10, 216)
  message:writenumber(pm11, 224)
  message:writenumber(pm12, 232)
  message:writenumber(pm13, 240)
  message:writenumber(pm14, 248)
  message:writenumber(pm15, 256)
  message:writenumber(pm16, 264)
  local cursor = 272

  for i = 1, vertexcount do
    local x, y, z = event:vertexxyz(i):get()
    local bone = event:vertexbone(i)
    local atlasmeta = event:vertexmeta(i)
    local u, v = event:vertexuv(i)
    local cr, cg, cb, ca = event:vertexcolour(i)
    message:writeinteger(x, cursor, 2)
    message:writeinteger(y, cursor + 2, 2)
    message:writeinteger(z, cursor + 4, 2)
    message:writeinteger(bone, cursor + 6, 2)
    message:writenumber(u, cursor + 8)
    message:writenumber(v, cursor + 16)
    message:writeinteger(atlasmeta, cursor + 24, 4)
    message:writeinteger(0, cursor + 28, 4) -- 4 unused bytes
    message:writenumber(cr, cursor + 32)
    message:writenumber(cg, cursor + 40)
    message:writenumber(cb, cursor + 48)
    message:writenumber(ca, cursor + 56)
    cursor = cursor + 64
  end
  for meta, rgba in pairs(images) do
    local imgx, imgy, imgw, imgh = event:atlasxywh(meta)
    message:writeinteger(meta, cursor, 4)
    message:writeinteger(imgw, cursor + 4, 2)
    message:writeinteger(imgh, cursor + 6, 2)
    message:writebuffer(rgba, cursor + 8)
    cursor = cursor + (imgw * imgh * 4) + 8
  end
  for bone, transform in pairs(animations) do
    local t1,  t2,  t3,  t4,
          t5,  t6,  t7,  t8,
          t9,  t10, t11, t12,
          t13, t14, t15, t16 = transform:get()
    message:writeinteger(bone, cursor, 2)
    message:writeinteger(0, cursor + 2, 6) -- 6 unused bytes
    message:writenumber(t1, cursor + 8)
    message:writenumber(t2, cursor + 16)
    message:writenumber(t3, cursor + 24)
    message:writenumber(t4, cursor + 32)
    message:writenumber(t5, cursor + 40)
    message:writenumber(t6, cursor + 48)
    message:writenumber(t7, cursor + 56)
    message:writenumber(t8, cursor + 64)
    message:writenumber(t9, cursor + 72)
    message:writenumber(t10, cursor + 80)
    message:writenumber(t11, cursor + 88)
    message:writenumber(t12, cursor + 96)
    message:writenumber(t13, cursor + 104)
    message:writenumber(t14, cursor + 112)
    message:writenumber(t15, cursor + 120)
    message:writenumber(t16, cursor + 128)
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
