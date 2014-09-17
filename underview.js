/*
 __  __     __   __     _____     ______     ______     __   __   __     ______     __     __    
/\ \/\ \   /\ "-.\ \   /\  __-.  /\  ___\   /\  == \   /\ \ / /  /\ \   /\  ___\   /\ \  _ \ \   
\ \ \_\ \  \ \ \-.  \  \ \ \/\ \ \ \  __\   \ \  __<   \ \ \'/   \ \ \  \ \  __\   \ \ \/ ".\ \  
 \ \_____\  \ \_\\"\_\  \ \____-  \ \_____\  \ \_\ \_\  \ \__|    \ \_\  \ \_____\  \ \__/".~\_\ 
  \/_____/   \/_/ \/_/   \/____/   \/_____/   \/_/ /_/   \/_/      \/_/   \/_____/   \/_/   \/_/ 
                                                                                                 
A different perspective on your data

*/

UV = {}


// canvas manipulation functions

// var UV.shift = function(context, dx) {
function shift(dx, context) {
  dx = dx || -1
  
  var w = context.canvas.width
  var h = context.canvas.height
  var imageData = context.getImageData(0, 0, w, h);
  
  context.clearRect(0, 0, w, h);
  context.putImageData(imageData, dx, 0);
  
  return false
}

// var UV.fancy_draw_cols = function(context, data, offset) {
function fancy_draw_cols(data, offset, context) {
  data = data || ds
  
  var w = context.canvas.width
  var h = context.canvas.height
  
  // var list = flatten(data)
  data.forEach(function(item, index) {
    var hue = item[0] ?    item[0]     : item
    var sat = item[1] ? ''+item[1]+'%' : '60%'
    var lit = item[2] ? ''+item[2]+'%' : '60%'
    
    var c = 'hsl(' + hue + ', ' + sat + ', ' + lit + ')'
    
    if(item == -1)
      c = 'hsl(0, 0%, 0%)'
      
    context.fillStyle = c
    context.fillRect(w-1-offset, index, 1, 1);
  })
  
  return false
}

function shifter(data, context) {
  shift(-1 * (data||[]).length, context)
  return data
}

function drawer(data, context) {
  var len = data.length
  data.forEach(function(arr, ind) {fancy_draw_cols(arr, len-ind, context)})
  return data
}



//// pipeline -> renderer

build_renderer = function(pipeline, context) {
  var queued_render = false
  var queued_data = []
  
  function renderer() {
    queued_render = false
    
    pipeline.reduce(function(data, fun) {
      return fun(data, context)
    }, queued_data)
    
    queued_data = []
  }
  
  return function(data) {
    queued_data.push(data) 
    if(queued_render) return false

    queued_render = true
    window.requestAnimationFrame(renderer)
    // setTimeout(renderer, 100)
  }
}


//////

function flatten(data) {
  if(!data && data !== 0)
    return NaN
  
  if(typeof data == 'object') 
    data = flatten_object(data)

  if(Array.isArray(data))
    return flatten_array(data)
  
  if(typeof data != 'number')
    return NaN
    
  return data
}

function flatten_array(arr) {
  return ['down'].concat(arr.reduce(function(acc, item) {return acc.concat(flatten(item))}, []).filter(NoNaN), 'up')
  // return arr.map(flatten).filter(NoNaN)
}

function flatten_object(obj) {
  return ['down'].concat(Object.keys(obj).reduce(function(acc, key) {return acc.concat(obj[key])}, []), 'up')
}

function NoNaN(x) {
  return x === x // o ___ o
}

var stupidGlobalSatConstant = 10
var stupidGlobalLitConstant = 40
var stupidGlobalSpdConstant = 30

var stupidGlobalHueFun = function(item, level) { return item }
var stupidGlobalSatFun = function(item, level) { return Math.max(100+level*stupidGlobalSatConstant, 0) }
var stupidGlobalLitFun = function(item, level) { return Math.max(100+level*stupidGlobalLitConstant, 0) }

var stupidGlobalBlackLines = false

setSat = function(x) {stupidGlobalSatConstant = x}
setLit = function(x) {stupidGlobalLitConstant = x}
setSpd = function(x) {stupidGlobalSpdConstant = x}

toggleBlack = function() {stupidGlobalBlackLines = !stupidGlobalBlackLines}
showBlack = function() {stupidGlobalBlackLines = true}

function valuation(list) {
  return list.map(function(data) {
    var level = 0
    return data.reduce(function(acc, item) {
      if(+item == item) {
        var hue = stupidGlobalHueFun(item, level)
        var sat = stupidGlobalSatFun(item, level)
        var lit = stupidGlobalLitFun(item, level)
        acc.push([hue, sat, lit]) // oh no not like that!
        return acc
      }
      
      if(item == 'down') level--
      if(item == 'up')   level++
      if(stupidGlobalBlackLines)
        acc.push([1, 1, 1])
      return acc
    }, [])
  })
}

function colorize(data) {
  return data
}


/// make it go. or stop. whatever.

going = false /// what are you serious? nononono. eradicate this.

function stop() {going = false}

var goer = function(fun) {
  going = true; 
  function really_go() {
    fun() 
    if(going) {
      if(+stupidGlobalSpdConstant)
        setTimeout(really_go, +stupidGlobalSpdConstant)
      else
        setImmediate(really_go)
    }
  }
  really_go()
  // ~(function really_go() {fun(step()); if(going) {setImmediate(really_go)}})()
}

function flatten_each(data) {return data.map(flatten)}



// helpers

function rand(n) { return Math.floor(Math.random() * (n||256)) }

function partial(fun) {
  var args = [].slice.call(arguments, 1)
  return function() {
    var new_args = [].slice.call(arguments)
    return fun.apply(fun, args.concat(new_args))
  }
}

~function() {
    //// postpone until next tick
    // inspired by http://dbaron.org/log/20100309-faster-timeouts
    var later = []
    var messageName = 12345
    var gimme_a_tick = true

    function setImmediate(fun) {
        later.push(fun)
    
        if(gimme_a_tick) {
            gimme_a_tick = false
            window.postMessage(messageName, "*")
        }
    
        return false
    }

    function handleMessage(event) {
        if(event.data != messageName) return false

        event.stopPropagation()
        gimme_a_tick = true

        var now = later
        later = []

        for(var i=0, l=now.length; i < l; i++)
            now[i]()
    }

    if(typeof window != 'undefined') {
        window.addEventListener('message', handleMessage, true)
        window.setImmediate = setImmediate
    }
}()



/*
  dead code

  function draw_color(context, color) {
    context = context || ctx
    color = color || Math.floor( Math.random() * 360 )
  
    var w = context.canvas.width
    var h = context.canvas.height
    var c = "hsl(" + color + ", 60%, 60%)"
  
    ctx.fillStyle = c
    ctx.fillRect(w-1, 0, 1, h);
  }
  
  function draw_cols(context, data, offset) {
    data = data || ds
  
    var w = context.canvas.width
    var h = context.canvas.height
  
    // var list = flatten(data)
    data.forEach(function(item, index) {        
      var c = "hsl(" + item + ", 60%, 60%)"
      if(item == -1)
        c = "hsl(0, 0%, 0%)"
      context.fillStyle = c
      context.fillRect(w-1-offset, index, 1, 1);
    })
  
    return false
  }

  

*/


/*

ok. hi! today you're going to do this stuff:
- observe the array and change the pixels based on it [copy + shift?]
- flatten deeper trees (multiple ways)
- color by value, diff, change, locality, etc
- open omnigraffle to start fiddling with structure diagrams
- build a simple animation thingy
- slides & more slides on paper or something
- notebook + paper + computer consolidation [where?]


step -> (draw + shift)
- draw takes an array of color data (either just h or hsl)

render -> doctor_data -> step

what I really want is a thing with some stuff that does things.

// try sequentially instead of adding randomly to the map
// binary tree -- change saturation so you can see unbalanced tree easily
// diff coloring so you can see hotspots

*/


