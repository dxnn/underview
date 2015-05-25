/*
 __  __     __   __     _____     ______     ______     __   __   __     ______     __     __    
/\ \/\ \   /\ "-.\ \   /\  __-.  /\  ___\   /\  == \   /\ \ / /  /\ \   /\  ___\   /\ \  _ \ \   
\ \ \_\ \  \ \ \-.  \  \ \ \/\ \ \ \  __\   \ \  __<   \ \ \'/   \ \ \  \ \  __\   \ \ \/ ".\ \  
 \ \_____\  \ \_\\"\_\  \ \____-  \ \_____\  \ \_\ \_\  \ \__|    \ \_\  \ \_____\  \ \__/".~\_\ 
  \/_____/   \/_/ \/_/   \/____/   \/_____/   \/_/ /_/   \/_/      \/_/   \/_____/   \/_/   \/_/ 
                                                                                                 
A different perspective on your data


Example using all the built-in goodies:

    var ctx = document.getElementById('canvas').getContext('2d') // get an html canvas element
    
    var pipeline  = ['flatten', 'valuation', 'colorize', 'shift-columns', 'draw-columns']
    var renderer  = UV.build_renderer(pipeline, ctx)
    var scheduler = UV.build_scheduler(renderer.draw)
    
    UV.add_stepper('simple_example',
      { init: function() { return [1,2,3] }
      , step: function(data) { return data.concat( rand() ) } } )
    
    scheduler.go('simple_example')
    
    
Example DIY explosion:

    var ctx = document.getElementById('canvas').getContext('2d') // get an html canvas element
    
    var draw = function(data, offset, ctx) {
      data.forEach(function(val, index) {
        ctx.fillStyle = 'hsl(' + index*2.6 + ', 100%, 80%)'
        ctx.fillRect(rand(ctx.canvas.width), rand(ctx.canvas.height), val, val)
      })
    }

    var pipeline = [flatten, draw]
    var renderer  = UV.build_renderer(pipeline, ctx)

    var x = [1,2,3,4,5,6]
    Array.observe(x, function() {renderer.draw(x)})

    var go = function(fun) {fun(); setTimeout(function() {go(fun)}, 200)}
    go(function() {x.push(rand(x.length)+1)})

*/
 

/*

TODOS

  --- make it work ---
    - horizontal structural view
    - mouseover data sample view
  --- then make it simple ---


  - branching pipelines to account for multiple views?
  - adjustable processing pipelines, with a live editable pipeline editor thing...

  - pixel compression (4-to-1 would show the 1024 transition) (both ways -- expansion too)
  - different flattening techniques (middle-out, BFS, etc)
  - color by value, diff, change, locality, etc
  - binary tree -- change saturation so you can see unbalanced tree easily
  - better example pages with many more examples

MAYBE
  So I had a dream where instead of wrapping the data and functionality together using closures
  there was just data, and the whole swack of it streamed through the processing pipeline.
  Respective pros/cons? Discuss.

*/


UV = {}                                                       // our namespace

UV.pipetypes = {}                                             // for the rendering pipeline
UV.steppers  = {}                                             // the data structure bits
UV.helpers   = {}                                             // mostly canvas wrappers

UV.add_pipetype = function(name, pipetype) {
  if(typeof pipetype != 'object') 
    return UV.error('Invalid pipetype')

  if( typeof pipetype.batch  != 'function' 
   && typeof pipetype.single != 'function'
    ) return UV.error('A pipetype needs a batch or single function')

  if(UV.pipetypes[name]) 
    return UV.error('A pipetype with that name already exists')

  UV.pipetypes[name] = pipetype
  return true
}

UV.add_stepper = function(name, stepper) {                    // a particular data structure progression
  if(typeof stepper != 'object') 
    return UV.error('Invalid stepper')

  if(UV.steppers[name]) 
    return UV.error('A stepper with that name already exists')

  if(typeof stepper.step != 'function')                       // step: DS -> DS
    return UV.error('A stepper must have a step function')

  if(typeof stepper.init != 'function')                       // generate initial DS
    stepper.init = UV.noop

  stepper.data = stepper.init()
  UV.steppers[name] = stepper
  return true
}


UV.build_renderer = function(pipeline, context) {             // pipeline is a list of pipetype names or funs
                                                              // context is a canvas context
  var state_map = {}
  var queued_data = []
  var pipeline_state = []
  var queued_render = false  
  var batchize = function(fun) 
    { return function(pallet, s, c) 
      { return pallet.map
        ( function(item) 
          { return fun(item, s, c) } ) } }
  
  // TODO: errors for bad pipeline and context
  
  pipeline.forEach(function(pipe, index) {
    pipeline_state[index] = {}                                // set default state
    if(typeof pipe != 'string') return false
    
    var pipetype = UV.pipetypes[pipe]
    pipeline_state[index] = pipetype.state || {}              // pipetype-specific default state
    state_map[pipe] = index                                   // map from pipetype name to index
  })                                                          // THINK: duplicate pipes with state get borked...
  
  pipeline = pipeline.map(function(pipe) {                    // transform into composable functions
    if(typeof pipe == 'function')
      return batchize(pipe)
    if(typeof pipe == 'string')
      pipe = UV.pipetypes[pipe]
    
    if(typeof (pipe||{}).batch == 'function')
      return pipe.batch
    if(typeof (pipe||{}).single == 'function')
      return batchize(pipe.single)
    
    return UV.error('Invalid pipe in pipeline') || UV.identity 
  })
  
  var really_draw = function() {
    queued_render = false
    
    pipeline.reduce(function(data, fun, index) {
      var output = fun(data, pipeline_state[index], context)
      
      if(Array.isArray(output)) return output                 // output array means no state
      
      pipeline_state[index] = output.state
      return output.data
    }, queued_data)
    
    queued_data = []
  }
  
  var draw = function(data) {
    queued_data.push(data) 
    if(queued_render) return false

    queued_render = true
    window.requestAnimationFrame(really_draw)                 // THINK: we could parametrize rAF
  }
  
  var set_state = function(pipetype, key, value) {
    var index = typeof pipetype == 'string' ? state_map[pipetype] : pipetype
    if(!index && index !== 0)
      return UV.error('Pipetype not present')

    var state = pipeline_state[index]
    if(typeof state != 'object')
      return UV.error('That state is invalid')
    
    state[key] = value                                        // mutation via pointer
  }
  
  var get_state = function(pipetype, key) {
    var index = typeof pipetype == 'string' ? state_map[pipetype] : pipetype
    if(!index && index !== 0)
      return UV.error('Pipetype not present')

    var state = pipeline_state[index]
    if(typeof state != 'object')
      return UV.error('That state is invalid')
    
    return state[key]
  }
  
  return { draw: draw
         , get: get_state
         , set: set_state
         }
}



UV.build_scheduler = function(renderer) {                     // builds a scheduler for scheduling things
  var going = false
  var delay = 30
  var iters = 0
  var stepper
  var onstep
  
  var step = function() {
    var result = stepper.step(stepper.data)                   // THINK: instantiate steppers? or clone?
    stepper.data = result
    renderer(result)
    
    if(!going) return false

    if(onstep) onstep(stepper.data, iters)
    iters++

    if(delay)
      setTimeout(step, delay)
    else
      setImmediate(step)
  }
  
  var go = function(str_or_fun) {
    var maybe_stepper = UV.steppers[str_or_fun]
    stepper = maybe_stepper ? maybe_stepper : str_or_fun

    if(going) return false
    
    going = true
    step()
  }

  var  stop = function( ) { going = false }
  var  ters = function( ) { return iters  }
  var speed = function(n) { delay = +n || 0 }
  var nstep = function(f) { onstep = f }
  
  return { go: go
         , stop: stop
         , step: step
         , iters: ters
         , speed: speed 
         , onstep: nstep
         }
}


/**********

  UV helper functions

**********/

UV.noop = function() {}

UV.identity = function(x) {return x}

UV.error = function(err) {                                    // replace this to suit your needs
  console.error(err)
}

UV.helpers.shift = function(dx, context) {                    // effectfully affects the canvas
  dx = dx || -1

  var w = context.canvas.width
  var h = context.canvas.height
  var imageData = context.getImageData(0, 0, w, h)

  context.clearRect(0, 0, w, h)
  context.putImageData(imageData, dx, 0)
}

UV.helpers.draw_column = function(data, offset, context) {    // effectfully affects the canvas
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
    context.fillRect(w-1-offset, index, 1, 1)
  })
}


/**********

  These helper functions are injected into the global scope ¯\_(ツ)_/¯

**********/

function flatten(data) {
  // TODO: handle cyclic data structures
  
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

function NoNaN(x) { return x === x /* o ___ o */ }

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



/**********

  Wherein we add sundry handy pipetypes

**********/

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

UV.add_pipetype('flatten', {
  single: 
    function(data) {
      return flatten(data) }})

UV.add_pipetype('colorize', {
  batch: UV.identity })

UV.add_pipetype('valuation', {
  state: { black: false
         , sat: 0
         , lit: 20
         , satfun: function(item, level, sat) { return Math.max(100+level*sat, 0) }
         , litfun: function(item, level, lit) { return Math.max(100+level*lit, 0) }
         } ,
  single: 
    function(data, state) {
      var level = 0
      return data.reduce(function(acc, item) {
        if(+item == item) {
          var hue = item
          var sat = state.satfun(item, level, state.sat)
          var lit = state.litfun(item, level, state.lit)
          acc.push([hue, sat, lit])
          return acc }
      
        if(item == 'down') level--
        if(item == 'up')   level++
        if(state.black)
          acc.push([1, 1, 1])
        return acc }, [] ) }})









/**********

  Experimental additions for half-baked tree view

**********/


XSIZE=3
YSIZE=1

function draw_tree(data, context, x, y) {
  x = x || 0
  y = y || 0

  var todo = [data, NaN]
  var longest = Object.keys(data).length
  var maxes = [longest]
  var generation = 0
  var min_y = y

  while(todo.length) {
    var data = todo.shift() // opt

    if(data !== data) {
      if(!todo.length) return true
      maxes.push(longest)
      x += XSIZE * maxes[generation] + XSIZE
      longest = 0 
      y = min_y
      generation++
      todo.push(NaN)
    }

    if(!data || typeof data != 'object') continue

    draw_list(data, context, x, y)

    y += YSIZE * 1
    // var count = 0
    var keys = Object.keys(data)
    // var len = keys.length

    keys.forEach(function(key) {
      if(data[key] && typeof data[key] == 'object') {
        todo.push(data[key])
        longest = Math.max(longest, Object.keys(data[key]).length)
        // count++
        // draw_tree(data[key], context, x + len, y + count*15)
      }
    })

  }
}


function draw_list(data, context, x, y) {
  var index = 0
  Object.keys(data).forEach(function(key) {
    var item = data[key]
    var hue = 0, sat = '0%', lit = '0%'

    if(item && isFinite(item)) {
      hue = item || 0
      sat = '60%'
      lit = '60%'
    }

    if(typeof item == 'string') {
      lit = '80%'
      sat = '100%'
      hue = 100
    }

    if(item && typeof item == 'object') {
      lit = '80%'
      sat = '100%'
      hue = 200
    }

    var c = 'hsl(' + hue + ', ' + sat + ', ' + lit + ')'

    context.fillStyle = c
    context.fillRect(+x+index*XSIZE, y, XSIZE, YSIZE);
    index++
  })
}
