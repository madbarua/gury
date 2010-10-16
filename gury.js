/*
  gury.js - A jQuery inspired canvas utility library

  Copyright (c) 2010 Ryan Sandor Richards

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.
*/

window.$g = window.Gury = (function(window, jQuery) {
  /*
   * Type Checking and Utility Functions
   */
  function isDefined() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (typeof v == "undefined" || v == null)
        return false;
    }
    return arguments.length > 0;
  }
  
  function isString(v) {
    return typeof v == "string";
  }
  
  function isObject(v) {
    return typeof v == "object";
  }
  
  function isFunction(v) {
    return typeof v == "function";
  }
  
  function isObjectOrFunction(v) {
    return isObject(v) || isFunction(v);
  }
  
  /*
   * Check for jQuery
   * TODO This might be removed with the plugin binding
   */
  var $ = jQuery;
  
  function jQueryAvailable() {
    return $ != null;
  }
  
  /*
   * Gury exception handling
   */
  var _failWithException = true;
  
  function GuryException(msg) {
    if (_failWithException) {
      throw "Gury: " + msg;
    }
  }
  
  /*
   * Hashtable Structure (for object -> object hashing)
   */
  var nextHash = 0;
  function Hashtable() {
    var table = this.table = {};
    var length = 0;

    function hash(object) {
      if (isString(object)) {
        return object;
      }
      if (!isDefined(object._gury_hash)) {
        object._gury_hash = nextHash++;
      }
      return object._gury_hash;
    }
    
    this.set = function(key, value) {
      if (isDefined(value)) {
        var h = hash(key);
        table[h] = value;
        length++;
      }
    };
    
    this.has = function(key) {
      var h = hash(key);
      return isDefined(table[h]);
    };
    
    this.get = function(key) {
      var h = hash(key);
      return table[h];
    };
    
    this.remove = function(key) {
      if (isDefined(key)) {
        var h = hask(key);
        delete table[h];
        length--;
      }
    };
    
    this.each = function(closure) {
      for (var h in table) {
        closure(table[h], h);
      }
      return this;
    };

    this.__defineGetter__("length", function() { return length; });
  }
  
  /*
   * Dynamic Set Structure
   */ 
  function Set(ord) {
    var table = this.table = new Hashtable();
    var ordered = this.ordered = ord ? [] : false;
    
    this.__defineGetter__("length", function() { return table.length; });
    
    this.has = function(object) {
      return table.has(object);
    };
    
    this.add = function(object) {
      if (table.has(object)) {
        return this;
      }
      
      if (ordered) {
        ordered.push(object);
      }
      table.set(object, object);
      return this;
    };

    this.remove = function(object) {
      if (!table.has(object)) {
        return null;
      }
      else if (ordered) {
        for (var k = 0; k < ordered.length; k++) {
          if (ordered[k] == object) {
            ordered.splice(k, 1);
            break;
          }
        }
      }
      table.remove(object);
      return object;
    };
    
    this.each = function(closure) {
      if (ordered) {
        for (var i = 0; i < ordered.length; i++) {
          closure(ordered[i], i);
        }
      }
      else {
        table.each(closure);
      }
      return this;
    };
	
    this.clear = function() {
      this.each(function(element, index) {
        this.remove(element);
      });
      return this;
    };
    
    this.sort = function(cmp) {
      if (isDefined(ordered)) {
        ordered.sort(cmp);
      }
      return this;
    };
  }
  
  /*
   * TagSpace Structure
   */
  function TagSpace() {
    this.name = name;
    this._children = {};
    this._objects = new Set();
  }
  TagSpace.prototype = (function() {
    var TAG_REGEX = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)*$/;
    
    return {
      hasChild: function(name) {
        return isObject(this._children[name]);
      },

      addChild: function(name) {
        return this._children[name] = new TagSpace(name);
      },

      getChild: function(name) {
        return this._children[name];
      },

      getObjects: function() {
        return this._objects;
      },

      find: function(tag) {
        if (!tag.match(TAG_REGEX)) {
          return null;
        }

        var currentSpace = this;
        var tags = tag.split('.');
        var lastName = tags[tags.length - 1];

        for (var i = 0; i < tags.length; i++) {
          if (!currentSpace.hasChild(tags[i]))
            return null;
          currentSpace = currentSpace.getChild(tags[i]);
        }

        return currentSpace;
      },

      add: function(tag, object) {
        if (!tag.match(TagSpace.TAG_REGEX)) {
          return null;
        }

        var currentSpace = this;
        var tags = tag.split('.');
        var lastName = tags[tags.length - 1];

        for (var i = 0; i < tags.length; i++) {
          if (currentSpace.hasChild(tags[i])) {
            currentSpace = currentSpace.getChild(tags[i]);
          }
          else {
            currentSpace = currentSpace.addChild(tags[i]);
          }
        }
        
        currentSpace._objects.add(object);

        return object;
      },

      clearObjects: function() {
        this._objects = new Set();
      },

      _remove_object: function(o) {
        this._objects.remove(o);
        for (var k in this._children) {
          var child = this._children[k];
          child._remove_object(o);
        }
      },

      remove: function(q) {
        var removed = new Set();

        if (isString(q)) {
          var space = this.find(q);
          if (!space) {
            return removed;
          }
          removed = space.getObjects();
          space.clearObjects();
        }
        else {
          this._remove_object(q);
          removed.add(q);
        }

        return removed;
      }
    };
  })();

  /*
   * HitMap Module
   * TODO Possibly expose showing and timing functionality in the future
   */
  var HitMap = window.hm = (function(show, time) {
    // Secondary hitmap canvas
    var map = document.createElement('canvas');
    var ctx = map.getContext('2d');
    
    if (show) {
      map.style.position = "absolute";
      map.style.top = "10px";
      map.style.left = "10px";
      map.style.background = "white";
      document.body.appendChild(map);
    }
    
    // Hit detection routines
    var lastWidth, lastHeight;
    
    function resetContext(gury) {
      var w = gury.canvas.width;
      var h = gury.canvas.height;
      if (w != lastWidth || h != lastHeight) {
        map.width = lastWidth = w;
        map.height = lastHeight = h;
      }
      ctx.clearRect(0, 0, w, h);
    }
    
    function draw(gury, object) {
      if (isFunction(object)) {
        ob.call(gury, ctx, gury.canvas);
      }
      else if (isObject(object) && isDefined(object.draw)) {
        object.draw(ctx, gury.canvas);
      }
    }
    
    function testPosition(x, y) {
      if (ctx == null) {
        return false;
      }
      
      var imageData = ctx.getImageData(0, 0, lastWidth, lastHeight);
      var w = imageData.width;
      var h = imageData.height;
      var data = imageData.data;
      
      if (x < 0 || x >= w || y < 0 || y >= h) {
        return false;
      }
      
      var pos = w*4*y + x*4;
      var red = imageData.data[pos];
      var green = imageData.data[pos+1];
      var blue = imageData.data[pos+2];
      var alpha = imageData.data[pos+3];
      
      return (red > 0 || green > 0 || blue > 0 || alpha > 0);
    }
    
    // Return the public interface
    return {
      hit: function(gury, object, x, y) {
        var timeStart;
        
        if (time) {
          timeStart = new Date().getTime();
        }
        
        var isHit = false;
        if (isObjectOrFunction(object)) {
          resetContext(gury);
          draw(gury, object);
          isHit = testPosition(x, y);
        }
        
        // Finish Timing
        if (time && console && console.log) {
          console.log("Hit detection completed in " + (new Date().getTime() - timeStart) + "ms");
        }
        
        return isHit;
      }
    };
  })(false, false);

  /*
   * Gury Core
   */
  function Gury(canvas, options) {
    if (canvas == null) {
      canvas = document.createElement('canvas');
    }
    
    // Check for an existing mapping from the canvas to a Gury instance
    if (GuryInterface.getGury(canvas)) {
      return GuryInterface.getGury(canvas);
    }
    
    // Otherwise create a new instance
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    this._objects = new Set(true);
    this._tags = new TagSpace('__global');
    
    this._paused = false;
    this._loop_interval = null;
  
    Events.init(this);
    
    var z = 0;
    
    this.nextZ = function() {
      return z++;
    };
    
    return GuryInterface.setGury(canvas, this);
  }
  Gury.prototype = {
    place: function(node) {
      if (jQueryAvailable()) {
        $(node).append(this.canvas);
      }
      else if (typeof node == "object" && typeof node.addChild == "function") {
        node.addChild(this.canvas);
      }
      else {
        GuryException("place() - Unable to place canvas tag (is jQuery loaded?)");
      }
      return this;
    },
    
    size: function(w, h) {
      this.canvas.width = w;
      this.canvas.height = h;
      return this;
    },
    
    background: function(bg) {
      this.canvas.style.background = bg;
      return this;
    },
    
    add: function() {
      var tag = null, object;

      if (arguments.length < 1) {
        return this;
      }
      else if (arguments.length < 2) {
        object = arguments[0];
        if (!isObjectOrFunction(object)) {
          return this;
        }
      }
      else {
        tag = arguments[0];
        object = arguments[1];
        if (!isString(name) || !isObjectOrFunction(object)) {
          return this;
        }
      }

      // Add the object to the global tag space (if a tag was provided)
      if (tag != null) {
        this._tags.add(tag, object);
      }

      // We can apply new tags using add, but we don't want to keep track of the
      // object twice in the master rendering list...
      if (this._objects.has(object)) {
        return this;
      }

      // Annotate the object with gury specific members
      if (!isDefined(object._gury)) {
        console.log('ADDED ANNOTATIONS');
        object._gury = { visible: true, paused: false, z: this.nextZ() };
      }

      // Add to the rendering list
      this._objects.add(object);

      return this;
    },
  
    remove: function(object) {
      if (isDefined(object)) {
        var gury = this;
        var removed = this._tags.remove(object);
        removed.each(function(r) {
          gury._objects.remove(r);
          delete r._gury;
        });
      }
      return this;
    },
  
    clear: function() {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return this;
    },
    
    update: function() {
      var gury = this;
      gury._objects.each(function(ob) {
        if (isDefined(ob.update) && !ob._gury.paused) {
          ob.update(gury);
        }
      });
      return this;
    },
    
    draw: function() {
      this.clear();

      var gury = this;
      gury._objects.each(function(ob) {
        if (!ob._gury.visible) {
          return;
        }

        if (typeof ob == "function") {
          ob.call(gury, gury.ctx, gury.canvas);
        }
        else if (typeof ob == "object" && typeof ob.draw != "undefined") {
          ob.draw(gury.ctx, gury.canvas);
        }
      });

      return this;
    },
    
    play: function(interval) {
      // Ignore multiple play attempts
      if (this._loop_interval != null) {
        return this;
      }

      // Immediately render the scene
      this.draw();

      // Start the rendering / update loop  
      var gury = this;
      this._loop_interval = setInterval(function() {
        if (!gury._paused) {
          gury.update().draw();
        }
      }, interval);
      return this;
    },
    
    pause: function() {
      if (arguments.length > 0) {
        for (var i = 0; i < arguments.length; i++) {
          var arg = arguments[i];
          if (isString(arg)) {
            this.each(arg, function(ob) {
              ob._gury.paused = !ob._gury.paused;
            });
          }
          else if (isDefined(arg._gury)) {
            arg._gury.paused = !arg._gury.paused;
          }
        }
        return this;
      }
      else {
        this._paused = !this._paused;
        return this;
      }
    },
    
    stop: function() {
      if (this._loop_interval != null) {
        clearInterval(this._loop_interval);
        this._paused = false;
      }
      return this;
    },
    
    each: function() {
      var tag, closure;

      if (arguments.length < 2 && isFunction(arguments[0])) {
        closure = arguments[0];
        this._objects.each(closure);
      }
      else if (isString(arguments[0]) && isFunction(arguments[1])) {
        tag = arguments[0];
        closure = arguments[1];
        var space = this._tags.find(tag);
        if (space) {
          space.getObjects().each(closure);
        }
      }
      else if (isFunction(arguments[0])) {
        closure = arguments[0];
        this._objects.each(closure);
      }
      else if (isFunction(arguments[1])) {
        closure = arguments[1];
        this._objects.each(closure);
      }

      return this;
    },
    
    hide: function(tag) {
      return this.each(tag, function(obj, index) {
        obj._gury.visible = false;
      });
    },
    
    show: function(tag) {
      return this.each(tag, function(obj, index) {
        obj._gury.visible = true;
      });
    },
    
    toggle: function(tag) {
      return this.each(tag, function(obj, index) {
        obj._gury.visible = !obj._gury.visible;
      });
    }
  };
  
  /* 
   * Object Events
   * TODO Document event system fully 
   */
  var Events = (function() {
    // Encapsulates an object in a set or finds a set of objects matching a tag
    function objects(gury, query) {
      var objects = new Set();
      if (isString(query)) {
        objects = gury._tags.find(query).getObjects();
      }
      else if (isDefined(query) && gury._objects.has(query)) {
        objects.add(query);
      }
      return objects;
    }
    
    // TODO Document me
    Gury.prototype.bind = function(q, event, closure) {
      if (isDefined(q, event, closure)) {
        var gury = this;
        var events = gury._events;

        objects(gury, q).each(function(ob) {
          if (!isDefined(events[event])) {
            events[event] = new Hashtable();
          }
          if (!events[event].has(ob)) {
            events[event].set(ob, {
              target: ob,
              handlers: []
            });
          }
          events[event].get(ob).handlers.push(closure);
        });
      }
      return this;
    };

    // TODO Document me
    Gury.prototype.unbind = function(object, event, closure) {
      if (isDefined(object, event)) {
        var gury = this;
        var events = gury._events;

        objects(gury, object).each(function(ob) {
          if (!isDefined(events[event])) {
            return;
          }
          if (!events[event].has(ob)) {
            return;
          }

          if (isDefined(closure)) {
            var handlers = events[event].get(ob).handlers;
            for (var i = 0; i < handlers.length; i++) {
              if (handlers[i] == closure) {
                handlers.splice(i, 1);
                break;
              }
            }
          }
          else {
            events[event].remove(ob);
          }
        });
      }
      return this;
    };

    // TODO Document me
    Gury.prototype.trigger = function(event, object, e) {
      if (isDefined(event, this._events[event], object)) {
        if (this._events[event].has(object)) {
          var handlers = this._events[event].get(object).handlers;
          for (var i = 0; i < handlers.length; i++) {
            handlers[i].call(object, e);
          }
        }
      }
      return this;
    };
    
    // Creates specific event methods for the Gury object itself
    function eventFunction(event) {
      return function(object, closure) {
        if (isDefined(object)) {
          if (isDefined(closure)) {
            this.bind(object, event, closure);
          }
          else {
            this.trigger(object, event);
          }
        }
        return this;
      };
    }
    
    // TODO Document me
    Gury.prototype.click = eventFunction('click');

    // TODO Document me
    Gury.prototype.mousedown = eventFunction('mousedown');

    // TODO Document me
    Gury.prototype.mouseup = eventFunction('mouseup');

    // TODO Document me
    Gury.prototype.mousemove = eventFunction('mousemove');
    
    // TODO Document me
    Gury.prototype.mouseenter = eventFunction('mouseenter');
    
    // TODO Document me
    Gury.prototype.mouseleave = eventFunction('mouseleave');
    
    // Adapted from: http://www.quirksmode.org/js/findpos.html
    function getPosition(gury, e) {
      var left = 0, top = 0;
      var object = gury.canvas;
      
      if (object.offsetParent) {
        while (object) {
          left += object.offsetLeft;
          top += object.offsetTop;
          object = object.offsetParent;
        }
      }
      
      return {
        x: e.pageX - left,
        y: e.pageY - top
      };
    }
    
    function triggerObjectAt(gury, e, name, closure) {
      if (isDefined(gury._events[name])) {
        var pos = getPosition(gury, e);
        var found = false;
        
        var sorted = new Set(true);
        gury._events[name].each(function(ob) { 
          sorted.add(ob.target); 
        });
        
        // TODO Look into avoiding resorts
        sorted.sort(function(a, b) {
          if (a._gury.z < b._gury.z) {
            return 1;
          }
          else {
            return -1;
          }
        }).each(function(ob) {
          if (!found && HitMap.hit(gury, ob, pos.x, pos.y)) {
            found = true;
            gury.trigger(name, ob, e);
            if (closure) {
              closure.call(ob);
            }
          }
        });
        
        if (!found && closure) {
          closure.call(null);
        }
      }
    }
    
    // The object the mouse is currently over
    var over = null;
    
    return {
      init: function(gury) {
        gury._events = {};
        var canvas = gury.canvas;

        // Mouse Events
        canvas.onclick = function(e) {
          triggerObjectAt(gury, e, 'click');
        };
        
        canvas.onmousedown = function(e) {
          triggerObjectAt(gury, e, 'mousedown');
        };
        
        canvas.onmouseup = function(e) {
          triggerObjectAt(gury, e, 'mouseup');
        };
        
        // Handles mousemove, mouseenter, and mouseleave
        canvas.onmousemove = function(e) {
          triggerObjectAt(gury, e, 'mousemove', function() {
            if (this != over) {
              if (isDefined(over)) {
                gury.trigger('mouseleave', over, e);
              }
              gury.trigger('mouseenter', this);
              over = this;
            }
          });
        };
        
        // Handles mouseleave when the user leaves the canvas itself
        canvas.onmouseleave = function(e) {
          if (over != null) {
            gury.trigger('mouseleave', over, e);
          }
        };
      }
    };
  })();
  
  /*
   * Public interface
   */
  var GuryInterface = (function() {
    var guryId = 1;
    var canvasToGury = {};
    
    function nextGuryId() { 
      return "gury_id_" + (guryId++); 
    }
    
    function Interface(q, options) {
      var defaultOptions = {};
      for (var k in defaultOptions) {
        if (!isDefined(options[k])) {
          options[k] = defaultOptions[k];
        }
      }

      var object;
      if (isString(q)) {
        object = document.getElementById(q);
      }
      else {
        object = null;
      }

      return new Gury(object, options);
    }

    Interface.failWithException = function(b) {
      if (!b) {
        return _failWithException;
      }
      return _failWithException = b ? true : false;
    };
    
    // TODO Document me
    Interface.getGury = function(canvas) {
      if (!isString(canvas._gury_id) || !(canvasToGury[canvas._gury_id] instanceof Gury)) {
        return null;
      }
      return canvasToGury[canvas._gury_id];
    };
    
    // TODO Document me
    Interface.setGury = function(canvas, gury) {
      if (typeof canvas._gury_id == "string") {
        gury.id = canvas._gury_id;
      }
      else {
        gury.id = canvas._gury_id = nextGuryId();
      }  
      return canvasToGury[gury.id] = gury;
    };
    
    return Interface;
  })(); 
  
  return GuryInterface;
})(window, window.jQuery);

/*
 * jQuery plugin integration
 * TODO Finish implementing me
 */
/*(function($) {
  if (typeof window.jQuery != "undefined" && window.jQuery != null) {
    window.jQuery.fn.gury = function(options) {
      this.each(function() {
        
      });
    }
  }
})(window.jQuery);*/

/* "There's a star man waiting in the sky. He'd like to come and meet us but 
    he think's he'll blow our minds." */
/* We'll miss you Mandelbrot */