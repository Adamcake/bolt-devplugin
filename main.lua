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

capturebuttonwindow = bolt.createwindow(cfg.buttonx, cfg.buttony, buttonwidth, buttonheight)

bolt.onswapbuffers(function (event)
  capturing = capturepending
  capturepending = false
  if capturing then
    local browser = bolt.createbrowser(1000, 750, "file://app/index.html")
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
  -- send all the details to the browser using capturebrowser:sendmessage
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
