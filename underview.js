/*
 __  __     __   __     _____     ______     ______     __   __   __     ______     __     __    
/\ \/\ \   /\ "-.\ \   /\  __-.  /\  ___\   /\  == \   /\ \ / /  /\ \   /\  ___\   /\ \  _ \ \   
\ \ \_\ \  \ \ \-.  \  \ \ \/\ \ \ \  __\   \ \  __<   \ \ \'/   \ \ \  \ \  __\   \ \ \/ ".\ \  
 \ \_____\  \ \_\\"\_\  \ \____-  \ \_____\  \ \_\ \_\  \ \__|    \ \_\  \ \_____\  \ \__/".~\_\ 
  \/_____/   \/_/ \/_/   \/____/   \/_____/   \/_/ /_/   \/_/      \/_/   \/_____/   \/_/   \/_/ 
                                                                                                 
A different perspective on your data

TODOS:
- allow multiple concurrent renderers
- per-instantiation vars for lit sat etc -- or... general getters/setters for pipetypes? maybe.
- pipetypes like flatten, valuation, colorize
- steppers like map_mori_r which have: init, step, ... maybe that's all?
- how do we do diffs? tree graphs? etc?

*/

UV = {}                                                     // our namespace

UV.pipetypes  = {}                                          // for the rendering pipeline
UV.steppers = {}                                            // the data structure bits
UV.helpers  = {}                                            // mostly canvas wrappers

UV.add_pipetype = function(name, pipetype) {
  if(typeof pipetype != 'object') 
    return UV.onError('Invalid pipetype')

  if( typeof pipetype.batch  != 'function' 
   && typeof pipetype.single != 'function'
    ) return UV.onError('A pipetype needs a batch or single function')

  if(UV.pipetypes[name]) 
    return UV.onError('A pipetype with that name already exists')

  UV.pipetypes[name] = pipetype
  return true
}

UV.add_stepper = function(name, stepper) {                   // a particular data structure progression
  if(typeof stepper != 'object') 
    return UV.onError('Invalid stepper')

  if(UV.steppers[name]) 
    return UV.onError('A stepper with that name already exists')

  if(typeof stepper.step != 'function')                      // step: DS -> DS
    return UV.onError('A stepper must have a step function')

  if(typeof stepper.init != 'function')                      // generate initial DS
    stepper.init = UV.noop

  stepper.data = stepper.init()
  UV.steppers[name] = stepper
  return true
}

UV.build_renderer = function(pipeline, context) {           // pipeline is a list of pipetype names or funs
                                                            // context is a canvas context
  var queued_render = false
  var queued_data = []
  var pipeline_state = []
  
  // TODO: errors for bad pipeline and context
  
  pipeline = pipeline.map(function(pipe) {                  // transform into composable functions
    if(typeof pipe == 'function')
      return pipe
    if(typeof pipe == 'string')
      pipe = UV.pipetypes[pipe]
    
    if(typeof (pipe||{}).batch == 'function')
      return pipe.batch
    if(typeof (pipe||{}).single == 'function')
      return function(pallet) {return pallet.map(pipe.single)}
    
    return UV.onError('Invalid pipe in pipeline') || UV.identity 
  })
  
  pipeline.forEach(function(pipe, index) {                  // capture state
    pipeline_state[index] = {} 
  })
  
  function renderer() {
    queued_render = false
    
    pipeline.reduce(function(data, fun, index) {
      var output = fun(data, pipeline_state[index], context)
      
      if(Array.isArray(output)) return output                // output array means no state
      
      pipeline_state[index] = output.state
      return output.data
    }, queued_data)
    
    queued_data = []
  }
  
  return function(data) {
    queued_data.push(data) 
    if(queued_render) return false

    queued_render = true
    window.requestAnimationFrame(renderer)                   // THINK: could parametrize rAF
  }
}



//////
// I apologize for what you're about to see
//////

var stupidGlobalBlackLines = false

var stupidGlobalSatConstant =  0
var stupidGlobalLitConstant = 20
var stupidGlobalSpdConstant = 30

var stupidGlobalHueFun = function(item, level) { return item }
var stupidGlobalSatFun = function(item, level) { return Math.max(100+level*stupidGlobalSatConstant, 0) }
var stupidGlobalLitFun = function(item, level) { return Math.max(100+level*stupidGlobalLitConstant, 0) }

setSat = function(x) {stupidGlobalSatConstant = x}
setLit = function(x) {stupidGlobalLitConstant = x}
setSpd = function(x) {stupidGlobalSpdConstant = x}

toggleBlack = function() {stupidGlobalBlackLines = !stupidGlobalBlackLines}
showBlack = function() {stupidGlobalBlackLines = true}


going = false

function stop() {going = false}

var scheduler = function(renderer, stepper) {
  going = true;
  function schedule() {
    var result = stepper.step(stepper.data) 
    stepper.data = result
    renderer(result)
    
    if(going) {
      if(+stupidGlobalSpdConstant)
        setTimeout(schedule, +stupidGlobalSpdConstant)
      else
        setImmediate(schedule)
    }
  }
  schedule()
  // ~(function really_go() {fun(step()); if(going) {setImmediate(really_go)}})()
}

// UV.get_stepfun = function(name) {
//   return UV.steppers[name]
//   // return function(stepfun) { renderer( stepfun() ) }
// }



// function flatten_each(data) {return data.map(flatten)}





/// UV helper functions

UV.noop = function() {}

UV.identity = function(x) {return x}

UV.onError = function(err) {                                 // replace this to suit your needs
  console.error(err)
}

UV.helpers.shift = function(dx, context) {                   // effectfully affects the canvas
  dx = dx || -1
  
  var w = context.canvas.width
  var h = context.canvas.height
  var imageData = context.getImageData(0, 0, w, h);
  
  context.clearRect(0, 0, w, h);
  context.putImageData(imageData, dx, 0);
}

UV.helpers.draw_column = function(data, offset, context) {   // effectfully affects the canvas
  data = data || ds
  
  var w = context.canvas.width
  var h = context.canvas.height
  
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
}




// canvas manipulation pipetypes

UV.add_pipetype('shift-columns', {
  batch: 
    function(data, state, context) {
      UV.helpers.shift(-1 * (data||[]).length, context)
      return data }})

UV.add_pipetype('draw-columns', {
  batch: 
    function(data, state, context) {
      var len = data.length
      data.forEach(function(arr, ind) {
        UV.helpers.draw_column(arr, len-ind, context)})
      return data }})

// other pipetypes

UV.add_pipetype('flatten', {
  single: 
    function(data) {
      return flatten(data) }})

UV.add_pipetype('colorize', {
  batch: UV.identity })

UV.add_pipetype('valuation', {
  single: 
    function(data) {
      var level = 0
      return data.reduce(function(acc, item) {
        if(+item == item) {
          var hue = stupidGlobalHueFun(item, level)
          var sat = stupidGlobalSatFun(item, level)
          var lit = stupidGlobalLitFun(item, level)
          acc.push([hue, sat, lit])
          return acc }
      
        if(item == 'down') level--
        if(item == 'up')   level++
        if(stupidGlobalBlackLines)
          acc.push([1, 1, 1])
        return acc }, [] ) }})



/// other helpers

function flatten(data) {
  if(!data && data !== 0)     return NaN
  
  if(Array.isArray(data))     return flatten_array(data)
  
  if(typeof data == 'object') return flatten_object(data)

  if(typeof data != 'number') return NaN
    
  return data
}

function flatten_array(arr)
  { return ['down'].concat
    ( arr
      . reduce
        ( function(acc, item) 
          { return acc.concat
            ( flatten(item) )}
        , [])
      . filter(NoNaN)
    , 'up') }

function flatten_object(obj)
  { return ['down'].concat
    ( Object.keys(obj).reduce
      ( function(acc, key) 
        { return acc.concat
          ( flatten(obj[key]))}, [])
    , 'up') }

function NoNaN(x) {
  return x === x // o ___ o
}



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


