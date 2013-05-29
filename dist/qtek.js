 (function(factory){
 	// AMD
 	if( typeof define !== "undefined" && define["amd"] ){
 		define( ["exports"], factory.bind(window) );
 	// No module loader
 	}else{
 		factory( window["qtek"] = {} );
 	}

})(function(_exports){

/**
 * almond 0.2.5 Copyright (c) 2011-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/almond for details
 */
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
     * Given a relative module name, like ./something, normalize it to
     * a real name that can be mapped to a path.
     * @param {String} name the relative name
     * @param {String} baseName a real name that the name arg is relative
     * to.
     * @returns {String} normalized name
     */
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);

                name = baseParts.concat(name.split("/"));

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has  config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
     * Makes a name map, normalizing the name, and using a plugin
     * for normalization if necessary. Grabs a ref to plugin
     * too, as an optimization.
     */
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (typeof callback === 'function') {

            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback.apply(defined[name], args);

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
     * Just drops the config on the floor, but returns req in case
     * the config return value is used.
     */
    req.config = function (cfg) {
        config = cfg;
        if (config.deps) {
            req(config.deps, config.callback);
        }
        return req;
    };

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("build/almond", function(){});

;
define("2d/camera", function(){});

define('core/mixin/derive',[],function(){

/**
 * derive a sub class from base class
 * @makeDefaultOpt [Object|Function] default option of this sub class, 
                        method of the sub can use this.xxx to access this option
 * @initialize [Function](optional) initialize after the sub class is instantiated
 * @proto [Object](optional) prototype methods/property of the sub class
 *
 * @export{object}
 */
function derive(makeDefaultOpt, initialize/*optional*/, proto/*optional*/){

    if( typeof initialize == "object"){
        proto = initialize;
        initialize = null;
    }

    // extend default prototype method
    var extendedProto = {
        // instanceof operator cannot work well,
        // so we write a method to simulate it
        'instanceof' : function(constructor){
            var selfConstructor = sub;
            while(selfConstructor){
                if( selfConstructor === constructor ){
                    return true;
                }
                selfConstructor = selfConstructor.__super__;
            }
        }
    }

    var _super = this;

    var sub = function(options){

        // call super constructor
        _super.call( this );

        // call defaultOpt generate function each time
        // if it is a function, So we can make sure each 
        // property in the object is fresh
        _.extend( this, typeof makeDefaultOpt == "function" ?
                        makeDefaultOpt.call(this) : makeDefaultOpt );

        _.extend( this, options );

        if( this.constructor == sub){
            // find the base class, and the initialize function will be called 
            // in the order of inherit
            var base = sub,
                initializeChain = [initialize];
            while(base.__super__){
                base = base.__super__;
                initializeChain.unshift( base.__initialize__ );
            }
            for(var i = 0; i < initializeChain.length; i++){
                if( initializeChain[i] ){
                    initializeChain[i].call( this );
                }
            }
        }
    };
    // save super constructor
    sub.__super__ = _super;
    // initialize function will be called after all the super constructor is called
    sub.__initialize__ = initialize;

    // extend prototype function
    _.extend( sub.prototype, _super.prototype, extendedProto, proto);

    sub.prototype.constructor = sub;
    
    // extend the derive method as a static method;
    sub.derive = _super.derive;


    return sub;
}

return {
    derive : derive
}

});
/**
 * Event interface
 *
 * @method on(eventName, handler[, context])
 * @method trigger(eventName[, arg1[, arg2]])
 * @method off(eventName[, handler])
 * @method has(eventName)
 * @export{object}
 */
define('core/mixin/notifier',[],function(){

    return{
        trigger : function(){
            if( ! this.__handlers__){
                return;
            }
            var name = arguments[0];
            var params = Array.prototype.slice.call( arguments, 1 );

            var handlers = this.__handlers__[ name ];
            if( handlers ){
                for( var i = 0; i < handlers.length; i+=2){
                    var handler = handlers[i],
                        context = handlers[i+1];
                    handler.apply(context || this, params);
                }
            }
        },
        
        on : function( target, handler, context/*optional*/ ){

            if( ! target){
                return;
            }
            var handlers = this.__handlers__ || ( this.__handlers__={} );
            if( ! handlers[target] ){
                handlers[target] = [];
            }
            if( handlers[target].indexOf(handler) == -1){
                // structure in list
                // [handler,context,handler,context,handler,context..]
                handlers[target].push( handler );
                handlers[target].push( context );
            }

            return handler;
        },

        off : function( target, handler ){
            
            var handlers = this.__handlers__ || ( this.__handlers__={} );

            if( handlers[target] ){
                if( handler ){
                    var arr = handlers[target];
                    // remove handler and context
                    var idx = arr.indexOf(handler);
                    if( idx >= 0)
                        arr.splice( idx, 2 );
                }else{
                    handlers[target] = [];
                }
            }
        },

        has : function( target, handler ){
            if( ! this.__handlers__ ||
                ! this.__handlers__[target] ){
                return false;
            }
            if( ! handler){
                return this.__handlers__[target].length;
            }else{
                return this.__handlers__[target].indexOf( handler ) !== -1;
            }
        }
    }
    
});
define('core/mixin/dirty', {

    dirty : function(propName){
        if( ! this._dirtyFlag ){
            this._dirtyFlag = {};
        }
        this._dirtyFlag[propName] = true;
    },
    
    fresh : function(propName){
        if( ! this._dirtyFlag ){
            this._dirtyFlag = {};
        }
        this._dirtyFlag[propName] = false;
    },

    
    isDirty : function(propName){
        if( ! this._dirtyFlag){
            this._dirtyFlag = {};
        }
        if(typeof(this._dirtyFlag[propName]) === "undefined"){
            return true;
        }
        return this._dirtyFlag[propName];
    },

} );
define('core/cache',[], function(){
    var Cache = function(){

        this._contextId = "",

        this._caches = {},

        this._context = {}

    }

    Cache.prototype = {

        use : function( contextId, documentSchema ){

            if( ! this._caches.hasOwnProperty( contextId ) ){
                this._caches[ contextId ] = {};

                if( documentSchema){
                    for(var name in documentSchema){
                        this._caches[contextId][ name ] = documentSchema[name];
                    }   
                }
            }
            this._contextId = contextId;

            this._context = this._caches[ contextId ];
        },

        put : function(key, value){

            this._context[ key ] = value;
        },

        get : function(key){

            return this._context[ key ];
        },

        clearContext : function(){
            this._caches[ this._contextId ] = {};
            this._context = {};
        },

        'delete' : function( key ){
            delete this._context[ key ];
        },

        clearAll : function(){
            this._caches = {};
        },

        getContext : function(){
            return this._context;
        },

        miss : function( key ){
            return ! this._context.hasOwnProperty( key );
        }
    }

    Cache.prototype.constructor = Cache;

    return Cache;

} );
/**
 * @license
 * Lo-Dash 1.1.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash -o ./dist/lodash.compat.js`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.4.4 <http://underscorejs.org/>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 * Available under MIT license <http://lodash.com/license>
 */
;(function(window) {

  /** Used as a safe reference for `undefined` in pre ES5 environments */
  var undefined;

  /** Detect free variable `exports` */
  var freeExports = typeof exports == 'object' && exports;

  /** Detect free variable `module` */
  var freeModule = typeof module == 'object' && module && module.exports == freeExports && module;

  /** Detect free variable `global` and use it as `window` */
  var freeGlobal = typeof global == 'object' && global;
  if (freeGlobal.global === freeGlobal) {
    window = freeGlobal;
  }

  /** Used to generate unique IDs */
  var idCounter = 0;

  /** Used internally to indicate various things */
  var indicatorObject = {};

  /** Used to match empty string literals in compiled template source */
  var reEmptyStringLeading = /\b__p \+= '';/g,
      reEmptyStringMiddle = /\b(__p \+=) '' \+/g,
      reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;

  /** Used to match HTML entities */
  var reEscapedHtml = /&(?:amp|lt|gt|quot|#39);/g;

  /**
   * Used to match ES6 template delimiters
   * http://people.mozilla.org/~jorendorff/es6-draft.html#sec-7.8.6
   */
  var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

  /** Used to match regexp flags from their coerced string values */
  var reFlags = /\w*$/;

  /** Used to match "interpolate" template delimiters */
  var reInterpolate = /<%=([\s\S]+?)%>/g;

  /** Used to match leading zeros to be removed */
  var reLeadingZeros = /^0+(?=.$)/;

  /** Used to ensure capturing order of template delimiters */
  var reNoMatch = /($^)/;

  /** Used to match HTML characters */
  var reUnescapedHtml = /[&<>"']/g;

  /** Used to match unescaped characters in compiled string literals */
  var reUnescapedString = /['\n\r\t\u2028\u2029\\]/g;

  /** Used to assign default `context` object properties */
  var contextProps = [
    'Array', 'Boolean', 'Date', 'Function', 'Math', 'Number', 'Object', 'RegExp',
    'String', '_', 'attachEvent', 'clearTimeout', 'isFinite', 'isNaN', 'parseInt',
    'setImmediate', 'setTimeout'
  ];

  /** Used to fix the JScript [[DontEnum]] bug */
  var shadowedProps = [
    'constructor', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
    'toLocaleString', 'toString', 'valueOf'
  ];

  /** Used to make template sourceURLs easier to identify */
  var templateCounter = 0;

  /** `Object#toString` result shortcuts */
  var argsClass = '[object Arguments]',
      arrayClass = '[object Array]',
      boolClass = '[object Boolean]',
      dateClass = '[object Date]',
      funcClass = '[object Function]',
      numberClass = '[object Number]',
      objectClass = '[object Object]',
      regexpClass = '[object RegExp]',
      stringClass = '[object String]';

  /** Used to identify object classifications that `_.clone` supports */
  var cloneableClasses = {};
  cloneableClasses[funcClass] = false;
  cloneableClasses[argsClass] = cloneableClasses[arrayClass] =
  cloneableClasses[boolClass] = cloneableClasses[dateClass] =
  cloneableClasses[numberClass] = cloneableClasses[objectClass] =
  cloneableClasses[regexpClass] = cloneableClasses[stringClass] = true;

  /** Used to determine if values are of the language type Object */
  var objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
  };

  /** Used to escape characters for inclusion in compiled string literals */
  var stringEscapes = {
    '\\': '\\',
    "'": "'",
    '\n': 'n',
    '\r': 'r',
    '\t': 't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  /*--------------------------------------------------------------------------*/

  /**
   * Create a new `lodash` function using the given `context` object.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Object} [context=window] The context object.
   * @returns {Function} Returns the `lodash` function.
   */
  function runInContext(context) {
    // Avoid issues with some ES3 environments that attempt to use values, named
    // after built-in constructors like `Object`, for the creation of literals.
    // ES5 clears this up by stating that literals must use built-in constructors.
    // See http://es5.github.com/#x11.1.5.
    context = context ? _.defaults(window.Object(), context, _.pick(window, contextProps)) : window;

    /** Native constructor references */
    var Array = context.Array,
        Boolean = context.Boolean,
        Date = context.Date,
        Function = context.Function,
        Math = context.Math,
        Number = context.Number,
        Object = context.Object,
        RegExp = context.RegExp,
        String = context.String,
        TypeError = context.TypeError;

    /** Used for `Array` and `Object` method references */
    var arrayRef = Array(),
        objectRef = Object();

    /** Used to restore the original `_` reference in `noConflict` */
    var oldDash = context._;

    /** Used to detect if a method is native */
    var reNative = RegExp('^' +
      String(objectRef.valueOf)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/valueOf|for [^\]]+/g, '.+?') + '$'
    );

    /** Native method shortcuts */
    var ceil = Math.ceil,
        clearTimeout = context.clearTimeout,
        concat = arrayRef.concat,
        floor = Math.floor,
        getPrototypeOf = reNative.test(getPrototypeOf = Object.getPrototypeOf) && getPrototypeOf,
        hasOwnProperty = objectRef.hasOwnProperty,
        push = arrayRef.push,
        setImmediate = context.setImmediate,
        setTimeout = context.setTimeout,
        toString = objectRef.toString;

    /* Native method shortcuts for methods with the same name as other `lodash` methods */
    var nativeBind = reNative.test(nativeBind = slice.bind) && nativeBind,
        nativeIsArray = reNative.test(nativeIsArray = Array.isArray) && nativeIsArray,
        nativeIsFinite = context.isFinite,
        nativeIsNaN = context.isNaN,
        nativeKeys = reNative.test(nativeKeys = Object.keys) && nativeKeys,
        nativeMax = Math.max,
        nativeMin = Math.min,
        nativeParseInt = context.parseInt,
        nativeRandom = Math.random;

    /** Detect various environments */
    var isIeOpera = reNative.test(context.attachEvent),
        isV8 = nativeBind && !/\n|true/.test(nativeBind + isIeOpera);

    /** Used to lookup a built-in constructor by [[Class]] */
    var ctorByClass = {};
    ctorByClass[arrayClass] = Array;
    ctorByClass[boolClass] = Boolean;
    ctorByClass[dateClass] = Date;
    ctorByClass[objectClass] = Object;
    ctorByClass[numberClass] = Number;
    ctorByClass[regexpClass] = RegExp;
    ctorByClass[stringClass] = String;

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a `lodash` object, that wraps the given `value`, to enable method
     * chaining.
     *
     * In addition to Lo-Dash methods, wrappers also have the following `Array` methods:
     * `concat`, `join`, `pop`, `push`, `reverse`, `shift`, `slice`, `sort`, `splice`,
     * and `unshift`
     *
     * Chaining is supported in custom builds as long as the `value` method is
     * implicitly or explicitly included in the build.
     *
     * The chainable wrapper functions are:
     * `after`, `assign`, `bind`, `bindAll`, `bindKey`, `chain`, `compact`,
     * `compose`, `concat`, `countBy`, `createCallback`, `debounce`, `defaults`,
     * `defer`, `delay`, `difference`, `filter`, `flatten`, `forEach`, `forIn`,
     * `forOwn`, `functions`, `groupBy`, `initial`, `intersection`, `invert`,
     * `invoke`, `keys`, `map`, `max`, `memoize`, `merge`, `min`, `object`, `omit`,
     * `once`, `pairs`, `partial`, `partialRight`, `pick`, `pluck`, `push`, `range`,
     * `reject`, `rest`, `reverse`, `shuffle`, `slice`, `sort`, `sortBy`, `splice`,
     * `tap`, `throttle`, `times`, `toArray`, `union`, `uniq`, `unshift`, `values`,
     * `where`, `without`, `wrap`, and `zip`
     *
     * The non-chainable wrapper functions are:
     * `clone`, `cloneDeep`, `contains`, `escape`, `every`, `find`, `has`,
     * `identity`, `indexOf`, `isArguments`, `isArray`, `isBoolean`, `isDate`,
     * `isElement`, `isEmpty`, `isEqual`, `isFinite`, `isFunction`, `isNaN`,
     * `isNull`, `isNumber`, `isObject`, `isPlainObject`, `isRegExp`, `isString`,
     * `isUndefined`, `join`, `lastIndexOf`, `mixin`, `noConflict`, `parseInt`,
     * `pop`, `random`, `reduce`, `reduceRight`, `result`, `shift`, `size`, `some`,
     * `sortedIndex`, `runInContext`, `template`, `unescape`, `uniqueId`, and `value`
     *
     * The wrapper functions `first` and `last` return wrapped values when `n` is
     * passed, otherwise they return unwrapped values.
     *
     * @name _
     * @constructor
     * @category Chaining
     * @param {Mixed} value The value to wrap in a `lodash` instance.
     * @returns {Object} Returns a `lodash` instance.
     */
    function lodash(value) {
      // don't wrap if already wrapped, even if wrapped by a different `lodash` constructor
      return (value && typeof value == 'object' && !isArray(value) && hasOwnProperty.call(value, '__wrapped__'))
       ? value
       : new lodashWrapper(value);
    }

    /**
     * An object used to flag environments features.
     *
     * @static
     * @memberOf _
     * @type Object
     */
    var support = lodash.support = {};

    (function() {
      var ctor = function() { this.x = 1; },
          object = { '0': 1, 'length': 1 },
          props = [];

      ctor.prototype = { 'valueOf': 1, 'y': 1 };
      for (var prop in new ctor) { props.push(prop); }
      for (prop in arguments) { }

      /**
       * Detect if `arguments` objects are `Object` objects (all but Opera < 10.5).
       *
       * @memberOf _.support
       * @type Boolean
       */
      support.argsObject = arguments.constructor == Object;

      /**
       * Detect if an `arguments` object's [[Class]] is resolvable (all but Firefox < 4, IE < 9).
       *
       * @memberOf _.support
       * @type Boolean
       */
      support.argsClass = isArguments(arguments);

      /**
       * Detect if `prototype` properties are enumerable by default.
       *
       * Firefox < 3.6, Opera > 9.50 - Opera < 11.60, and Safari < 5.1
       * (if the prototype or a property on the prototype has been set)
       * incorrectly sets a function's `prototype` property [[Enumerable]]
       * value to `true`.
       *
       * @memberOf _.support
       * @type Boolean
       */
      support.enumPrototypes = ctor.propertyIsEnumerable('prototype');

      /**
       * Detect if `Function#bind` exists and is inferred to be fast (all but V8).
       *
       * @memberOf _.support
       * @type Boolean
       */
      support.fastBind = nativeBind && !isV8;

      /**
       * Detect if own properties are iterated after inherited properties (all but IE < 9).
       *
       * @memberOf _.support
       * @type Boolean
       */
      support.ownLast = props[0] != 'x';

      /**
       * Detect if `arguments` object indexes are non-enumerable
       * (Firefox < 4, IE < 9, PhantomJS, Safari < 5.1).
       *
       * @memberOf _.support
       * @type Boolean
       */
      support.nonEnumArgs = prop != 0;

      /**
       * Detect if properties shadowing those on `Object.prototype` are non-enumerable.
       *
       * In IE < 9 an objects own properties, shadowing non-enumerable ones, are
       * made non-enumerable as well (a.k.a the JScript [[DontEnum]] bug).
       *
       * @memberOf _.support
       * @type Boolean
       */
      support.nonEnumShadows = !/valueOf/.test(props);

      /**
       * Detect if `Array#shift` and `Array#splice` augment array-like objects correctly.
       *
       * Firefox < 10, IE compatibility mode, and IE < 9 have buggy Array `shift()`
       * and `splice()` functions that fail to remove the last element, `value[0]`,
       * of array-like objects even though the `length` property is set to `0`.
       * The `shift()` method is buggy in IE 8 compatibility mode, while `splice()`
       * is buggy regardless of mode in IE < 9 and buggy in compatibility mode in IE 9.
       *
       * @memberOf _.support
       * @type Boolean
       */
      support.spliceObjects = (arrayRef.splice.call(object, 0, 1), !object[0]);

      /**
       * Detect lack of support for accessing string characters by index.
       *
       * IE < 8 can't access characters by index and IE 8 can only access
       * characters by index on string literals.
       *
       * @memberOf _.support
       * @type Boolean
       */
      support.unindexedChars = ('x'[0] + Object('x')[0]) != 'xx';

      /**
       * Detect if a DOM node's [[Class]] is resolvable (all but IE < 9)
       * and that the JS engine errors when attempting to coerce an object to
       * a string without a `toString` function.
       *
       * @memberOf _.support
       * @type Boolean
       */
      try {
        support.nodeClass = !(toString.call(document) == objectClass && !({ 'toString': 0 } + ''));
      } catch(e) {
        support.nodeClass = true;
      }
    }(1));

    /**
     * By default, the template delimiters used by Lo-Dash are similar to those in
     * embedded Ruby (ERB). Change the following template settings to use alternative
     * delimiters.
     *
     * @static
     * @memberOf _
     * @type Object
     */
    lodash.templateSettings = {

      /**
       * Used to detect `data` property values to be HTML-escaped.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'escape': /<%-([\s\S]+?)%>/g,

      /**
       * Used to detect code to be evaluated.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'evaluate': /<%([\s\S]+?)%>/g,

      /**
       * Used to detect `data` property values to inject.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'interpolate': reInterpolate,

      /**
       * Used to reference the data object in the template text.
       *
       * @memberOf _.templateSettings
       * @type String
       */
      'variable': '',

      /**
       * Used to import variables into the compiled template.
       *
       * @memberOf _.templateSettings
       * @type Object
       */
      'imports': {

        /**
         * A reference to the `lodash` function.
         *
         * @memberOf _.templateSettings.imports
         * @type Function
         */
        '_': lodash
      }
    };

    /*--------------------------------------------------------------------------*/

    /**
     * The template used to create iterator functions.
     *
     * @private
     * @param {Obect} data The data object used to populate the text.
     * @returns {String} Returns the interpolated text.
     */
    var iteratorTemplate = function(obj) {

      var __p = 'var index, iterable = ' +
      (obj.firstArg) +
      ', result = ' +
      (obj.init) +
      ';\nif (!iterable) return result;\n' +
      (obj.top) +
      ';\n';
       if (obj.arrays) {
      __p += 'var length = iterable.length; index = -1;\nif (' +
      (obj.arrays) +
      ') {  ';
       if (support.unindexedChars) {
      __p += '\n  if (isString(iterable)) {\n    iterable = iterable.split(\'\')\n  }  ';
       }
      __p += '\n  while (++index < length) {\n    ' +
      (obj.loop) +
      '\n  }\n}\nelse {  ';
        } else if (support.nonEnumArgs) {
      __p += '\n  var length = iterable.length; index = -1;\n  if (length && isArguments(iterable)) {\n    while (++index < length) {\n      index += \'\';\n      ' +
      (obj.loop) +
      '\n    }\n  } else {  ';
       }

       if (support.enumPrototypes) {
      __p += '\n  var skipProto = typeof iterable == \'function\';\n  ';
       }

       if (obj.useHas && obj.useKeys) {
      __p += '\n  var ownIndex = -1,\n      ownProps = objectTypes[typeof iterable] ? keys(iterable) : [],\n      length = ownProps.length;\n\n  while (++ownIndex < length) {\n    index = ownProps[ownIndex];\n    ';
       if (support.enumPrototypes) {
      __p += 'if (!(skipProto && index == \'prototype\')) {\n  ';
       }
      __p += 
      (obj.loop);
       if (support.enumPrototypes) {
      __p += '}\n';
       }
      __p += '  }  ';
       } else {
      __p += '\n  for (index in iterable) {';
          if (support.enumPrototypes || obj.useHas) {
      __p += '\n    if (';
            if (support.enumPrototypes) {
      __p += '!(skipProto && index == \'prototype\')';
       }      if (support.enumPrototypes && obj.useHas) {
      __p += ' && ';
       }      if (obj.useHas) {
      __p += 'hasOwnProperty.call(iterable, index)';
       }
      __p += ') {    ';
       }
      __p += 
      (obj.loop) +
      ';    ';
       if (support.enumPrototypes || obj.useHas) {
      __p += '\n    }';
       }
      __p += '\n  }    ';
       if (support.nonEnumShadows) {
      __p += '\n\n  var ctor = iterable.constructor;\n      ';
       for (var k = 0; k < 7; k++) {
      __p += '\n  index = \'' +
      (obj.shadowedProps[k]) +
      '\';\n  if (';
            if (obj.shadowedProps[k] == 'constructor') {
      __p += '!(ctor && ctor.prototype === iterable) && ';
            }
      __p += 'hasOwnProperty.call(iterable, index)) {\n    ' +
      (obj.loop) +
      '\n  }      ';
       }

       }

       }

       if (obj.arrays || support.nonEnumArgs) {
      __p += '\n}';
       }
      __p += 
      (obj.bottom) +
      ';\nreturn result';

      return __p
    };

    /** Reusable iterator options for `assign` and `defaults` */
    var defaultsIteratorOptions = {
      'args': 'object, source, guard',
      'top':
        'var args = arguments,\n' +
        '    argsIndex = 0,\n' +
        "    argsLength = typeof guard == 'number' ? 2 : args.length;\n" +
        'while (++argsIndex < argsLength) {\n' +
        '  iterable = args[argsIndex];\n' +
        '  if (iterable && objectTypes[typeof iterable]) {',
      'loop': "if (typeof result[index] == 'undefined') result[index] = iterable[index]",
      'bottom': '  }\n}'
    };

    /** Reusable iterator options shared by `each`, `forIn`, and `forOwn` */
    var eachIteratorOptions = {
      'args': 'collection, callback, thisArg',
      'top': "callback = callback && typeof thisArg == 'undefined' ? callback : lodash.createCallback(callback, thisArg)",
      'arrays': "typeof length == 'number'",
      'loop': 'if (callback(iterable[index], index, collection) === false) return result'
    };

    /** Reusable iterator options for `forIn` and `forOwn` */
    var forOwnIteratorOptions = {
      'top': 'if (!objectTypes[typeof iterable]) return result;\n' + eachIteratorOptions.top,
      'arrays': false
    };

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a function optimized to search large arrays for a given `value`,
     * starting at `fromIndex`, using strict equality for comparisons, i.e. `===`.
     *
     * @private
     * @param {Array} array The array to search.
     * @param {Mixed} value The value to search for.
     * @param {Number} fromIndex The index to search from.
     * @param {Number} largeSize The length at which an array is considered large.
     * @returns {Boolean} Returns `true`, if `value` is found, else `false`.
     */
    function cachedContains(array, fromIndex, largeSize) {
      var length = array.length,
          isLarge = (length - fromIndex) >= largeSize;

      if (isLarge) {
        var cache = {},
            index = fromIndex - 1;

        while (++index < length) {
          // manually coerce `value` to a string because `hasOwnProperty`, in some
          // older versions of Firefox, coerces objects incorrectly
          var key = String(array[index]);
          (hasOwnProperty.call(cache, key) ? cache[key] : (cache[key] = [])).push(array[index]);
        }
      }
      return function(value) {
        if (isLarge) {
          var key = String(value);
          return hasOwnProperty.call(cache, key) && indexOf(cache[key], value) > -1;
        }
        return indexOf(array, value, fromIndex) > -1;
      }
    }

    /**
     * Used by `_.max` and `_.min` as the default `callback` when a given
     * `collection` is a string value.
     *
     * @private
     * @param {String} value The character to inspect.
     * @returns {Number} Returns the code unit of given character.
     */
    function charAtCallback(value) {
      return value.charCodeAt(0);
    }

    /**
     * Used by `sortBy` to compare transformed `collection` values, stable sorting
     * them in ascending order.
     *
     * @private
     * @param {Object} a The object to compare to `b`.
     * @param {Object} b The object to compare to `a`.
     * @returns {Number} Returns the sort order indicator of `1` or `-1`.
     */
    function compareAscending(a, b) {
      var ai = a.index,
          bi = b.index;

      a = a.criteria;
      b = b.criteria;

      // ensure a stable sort in V8 and other engines
      // http://code.google.com/p/v8/issues/detail?id=90
      if (a !== b) {
        if (a > b || typeof a == 'undefined') {
          return 1;
        }
        if (a < b || typeof b == 'undefined') {
          return -1;
        }
      }
      return ai < bi ? -1 : 1;
    }

    /**
     * Creates a function that, when called, invokes `func` with the `this` binding
     * of `thisArg` and prepends any `partialArgs` to the arguments passed to the
     * bound function.
     *
     * @private
     * @param {Function|String} func The function to bind or the method name.
     * @param {Mixed} [thisArg] The `this` binding of `func`.
     * @param {Array} partialArgs An array of arguments to be partially applied.
     * @param {Object} [idicator] Used to indicate binding by key or partially
     *  applying arguments from the right.
     * @returns {Function} Returns the new bound function.
     */
    function createBound(func, thisArg, partialArgs, indicator) {
      var isFunc = isFunction(func),
          isPartial = !partialArgs,
          key = thisArg;

      // juggle arguments
      if (isPartial) {
        var rightIndicator = indicator;
        partialArgs = thisArg;
      }
      else if (!isFunc) {
        if (!indicator) {
          throw new TypeError;
        }
        thisArg = func;
      }

      function bound() {
        // `Function#bind` spec
        // http://es5.github.com/#x15.3.4.5
        var args = arguments,
            thisBinding = isPartial ? this : thisArg;

        if (!isFunc) {
          func = thisArg[key];
        }
        if (partialArgs.length) {
          args = args.length
            ? (args = slice(args), rightIndicator ? args.concat(partialArgs) : partialArgs.concat(args))
            : partialArgs;
        }
        if (this instanceof bound) {
          // ensure `new bound` is an instance of `func`
          noop.prototype = func.prototype;
          thisBinding = new noop;
          noop.prototype = null;

          // mimic the constructor's `return` behavior
          // http://es5.github.com/#x13.2.2
          var result = func.apply(thisBinding, args);
          return isObject(result) ? result : thisBinding;
        }
        return func.apply(thisBinding, args);
      }
      return bound;
    }

    /**
     * Creates compiled iteration functions.
     *
     * @private
     * @param {Object} [options1, options2, ...] The compile options object(s).
     *  arrays - A string of code to determine if the iterable is an array or array-like.
     *  useHas - A boolean to specify using `hasOwnProperty` checks in the object loop.
     *  args - A string of comma separated arguments the iteration function will accept.
     *  top - A string of code to execute before the iteration branches.
     *  loop - A string of code to execute in the object loop.
     *  bottom - A string of code to execute after the iteration branches.
     * @returns {Function} Returns the compiled function.
     */
    function createIterator() {
      var data = {
        // data properties
        'shadowedProps': shadowedProps,
        // iterator options
        'arrays': 'isArray(iterable)',
        'bottom': '',
        'init': 'iterable',
        'loop': '',
        'top': '',
        'useHas': true,
        'useKeys': !!keys
      };

      // merge options into a template data object
      for (var object, index = 0; object = arguments[index]; index++) {
        for (var key in object) {
          data[key] = object[key];
        }
      }
      var args = data.args;
      data.firstArg = /^[^,]+/.exec(args)[0];

      // create the function factory
      var factory = Function(
          'hasOwnProperty, isArguments, isArray, isString, keys, ' +
          'lodash, objectTypes',
        'return function(' + args + ') {\n' + iteratorTemplate(data) + '\n}'
      );
      // return the compiled function
      return factory(
        hasOwnProperty, isArguments, isArray, isString, keys,
        lodash, objectTypes
      );
    }

    /**
     * Used by `template` to escape characters for inclusion in compiled
     * string literals.
     *
     * @private
     * @param {String} match The matched character to escape.
     * @returns {String} Returns the escaped character.
     */
    function escapeStringChar(match) {
      return '\\' + stringEscapes[match];
    }

    /**
     * Used by `escape` to convert characters to HTML entities.
     *
     * @private
     * @param {String} match The matched character to escape.
     * @returns {String} Returns the escaped character.
     */
    function escapeHtmlChar(match) {
      return htmlEscapes[match];
    }

    /**
     * Checks if `value` is a DOM node in IE < 9.
     *
     * @private
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true` if the `value` is a DOM node, else `false`.
     */
    function isNode(value) {
      // IE < 9 presents DOM nodes as `Object` objects except they have `toString`
      // methods that are `typeof` "string" and still can coerce nodes to strings
      return typeof value.toString != 'function' && typeof (value + '') == 'string';
    }

    /**
     * A fast path for creating `lodash` wrapper objects.
     *
     * @private
     * @param {Mixed} value The value to wrap in a `lodash` instance.
     * @returns {Object} Returns a `lodash` instance.
     */
    function lodashWrapper(value) {
      this.__wrapped__ = value;
    }
    // ensure `new lodashWrapper` is an instance of `lodash`
    lodashWrapper.prototype = lodash.prototype;

    /**
     * A no-operation function.
     *
     * @private
     */
    function noop() {
      // no operation performed
    }

    /**
     * A fallback implementation of `isPlainObject` that checks if a given `value`
     * is an object created by the `Object` constructor, assuming objects created
     * by the `Object` constructor have no inherited enumerable properties and that
     * there are no `Object.prototype` extensions.
     *
     * @private
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if `value` is a plain object, else `false`.
     */
    function shimIsPlainObject(value) {
      // avoid non-objects and false positives for `arguments` objects
      var result = false;
      if (!(value && toString.call(value) == objectClass) || (!support.argsClass && isArguments(value))) {
        return result;
      }
      // check that the constructor is `Object` (i.e. `Object instanceof Object`)
      var ctor = value.constructor;

      if (isFunction(ctor) ? ctor instanceof ctor : (support.nodeClass || !isNode(value))) {
        // IE < 9 iterates inherited properties before own properties. If the first
        // iterated property is an object's own property then there are no inherited
        // enumerable properties.
        if (support.ownLast) {
          forIn(value, function(value, key, object) {
            result = hasOwnProperty.call(object, key);
            return false;
          });
          return result === true;
        }
        // In most environments an object's own properties are iterated before
        // its inherited properties. If the last iterated property is an object's
        // own property then there are no inherited enumerable properties.
        forIn(value, function(value, key) {
          result = key;
        });
        return result === false || hasOwnProperty.call(value, result);
      }
      return result;
    }

    /**
     * Slices the `collection` from the `start` index up to, but not including,
     * the `end` index.
     *
     * Note: This function is used, instead of `Array#slice`, to support node lists
     * in IE < 9 and to ensure dense arrays are returned.
     *
     * @private
     * @param {Array|Object|String} collection The collection to slice.
     * @param {Number} start The start index.
     * @param {Number} end The end index.
     * @returns {Array} Returns the new array.
     */
    function slice(array, start, end) {
      start || (start = 0);
      if (typeof end == 'undefined') {
        end = array ? array.length : 0;
      }
      var index = -1,
          length = end - start || 0,
          result = Array(length < 0 ? 0 : length);

      while (++index < length) {
        result[index] = array[start + index];
      }
      return result;
    }

    /**
     * Used by `unescape` to convert HTML entities to characters.
     *
     * @private
     * @param {String} match The matched character to unescape.
     * @returns {String} Returns the unescaped character.
     */
    function unescapeHtmlChar(match) {
      return htmlUnescapes[match];
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Checks if `value` is an `arguments` object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is an `arguments` object, else `false`.
     * @example
     *
     * (function() { return _.isArguments(arguments); })(1, 2, 3);
     * // => true
     *
     * _.isArguments([1, 2, 3]);
     * // => false
     */
    function isArguments(value) {
      return toString.call(value) == argsClass;
    }
    // fallback for browsers that can't detect `arguments` objects by [[Class]]
    if (!support.argsClass) {
      isArguments = function(value) {
        return value ? hasOwnProperty.call(value, 'callee') : false;
      };
    }

    /**
     * Checks if `value` is an array.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is an array, else `false`.
     * @example
     *
     * (function() { return _.isArray(arguments); })();
     * // => false
     *
     * _.isArray([1, 2, 3]);
     * // => true
     */
    var isArray = nativeIsArray || function(value) {
      // `instanceof` may cause a memory leak in IE 7 if `value` is a host object
      // http://ajaxian.com/archives/working-aroung-the-instanceof-memory-leak
      return (support.argsObject && value instanceof Array) || toString.call(value) == arrayClass;
    };

    /**
     * A fallback implementation of `Object.keys` that produces an array of the
     * given object's own enumerable property names.
     *
     * @private
     * @type Function
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns a new array of property names.
     */
    var shimKeys = createIterator({
      'args': 'object',
      'init': '[]',
      'top': 'if (!(objectTypes[typeof object])) return result',
      'loop': 'result.push(index)',
      'arrays': false
    });

    /**
     * Creates an array composed of the own enumerable property names of `object`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns a new array of property names.
     * @example
     *
     * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
     * // => ['one', 'two', 'three'] (order is not guaranteed)
     */
    var keys = !nativeKeys ? shimKeys : function(object) {
      if (!isObject(object)) {
        return [];
      }
      if ((support.enumPrototypes && typeof object == 'function') ||
          (support.nonEnumArgs && object.length && isArguments(object))) {
        return shimKeys(object);
      }
      return nativeKeys(object);
    };

    /**
     * A function compiled to iterate `arguments` objects, arrays, objects, and
     * strings consistenly across environments, executing the `callback` for each
     * element in the `collection`. The `callback` is bound to `thisArg` and invoked
     * with three arguments; (value, index|key, collection). Callbacks may exit
     * iteration early by explicitly returning `false`.
     *
     * @private
     * @type Function
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Array|Object|String} Returns `collection`.
     */
    var each = createIterator(eachIteratorOptions);

    /**
     * Used to convert characters to HTML entities:
     *
     * Though the `>` character is escaped for symmetry, characters like `>` and `/`
     * don't require escaping in HTML and have no special meaning unless they're part
     * of a tag or an unquoted attribute value.
     * http://mathiasbynens.be/notes/ambiguous-ampersands (under "semi-related fun fact")
     */
    var htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    /** Used to convert HTML entities to characters */
    var htmlUnescapes = invert(htmlEscapes);

    /*--------------------------------------------------------------------------*/

    /**
     * Assigns own enumerable properties of source object(s) to the destination
     * object. Subsequent sources will overwrite property assignments of previous
     * sources. If a `callback` function is passed, it will be executed to produce
     * the assigned values. The `callback` is bound to `thisArg` and invoked with
     * two arguments; (objectValue, sourceValue).
     *
     * @static
     * @memberOf _
     * @type Function
     * @alias extend
     * @category Objects
     * @param {Object} object The destination object.
     * @param {Object} [source1, source2, ...] The source objects.
     * @param {Function} [callback] The function to customize assigning values.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * _.assign({ 'name': 'moe' }, { 'age': 40 });
     * // => { 'name': 'moe', 'age': 40 }
     *
     * var defaults = _.partialRight(_.assign, function(a, b) {
     *   return typeof a == 'undefined' ? b : a;
     * });
     *
     * var food = { 'name': 'apple' };
     * defaults(food, { 'name': 'banana', 'type': 'fruit' });
     * // => { 'name': 'apple', 'type': 'fruit' }
     */
    var assign = createIterator(defaultsIteratorOptions, {
      'top':
        defaultsIteratorOptions.top.replace(';',
          ';\n' +
          "if (argsLength > 3 && typeof args[argsLength - 2] == 'function') {\n" +
          '  var callback = lodash.createCallback(args[--argsLength - 1], args[argsLength--], 2);\n' +
          "} else if (argsLength > 2 && typeof args[argsLength - 1] == 'function') {\n" +
          '  callback = args[--argsLength];\n' +
          '}'
        ),
      'loop': 'result[index] = callback ? callback(result[index], iterable[index]) : iterable[index]'
    });

    /**
     * Creates a clone of `value`. If `deep` is `true`, nested objects will also
     * be cloned, otherwise they will be assigned by reference. If a `callback`
     * function is passed, it will be executed to produce the cloned values. If
     * `callback` returns `undefined`, cloning will be handled by the method instead.
     * The `callback` is bound to `thisArg` and invoked with one argument; (value).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to clone.
     * @param {Boolean} [deep=false] A flag to indicate a deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @param- {Array} [stackA=[]] Tracks traversed source objects.
     * @param- {Array} [stackB=[]] Associates clones with source counterparts.
     * @returns {Mixed} Returns the cloned `value`.
     * @example
     *
     * var stooges = [
     *   { 'name': 'moe', 'age': 40 },
     *   { 'name': 'larry', 'age': 50 }
     * ];
     *
     * var shallow = _.clone(stooges);
     * shallow[0] === stooges[0];
     * // => true
     *
     * var deep = _.clone(stooges, true);
     * deep[0] === stooges[0];
     * // => false
     *
     * _.mixin({
     *   'clone': _.partialRight(_.clone, function(value) {
     *     return _.isElement(value) ? value.cloneNode(false) : undefined;
     *   })
     * });
     *
     * var clone = _.clone(document.body);
     * clone.childNodes.length;
     * // => 0
     */
    function clone(value, deep, callback, thisArg, stackA, stackB) {
      var result = value;

      // allows working with "Collections" methods without using their `callback`
      // argument, `index|key`, for this method's `callback`
      if (typeof deep == 'function') {
        thisArg = callback;
        callback = deep;
        deep = false;
      }
      if (typeof callback == 'function') {
        callback = (typeof thisArg == 'undefined')
          ? callback
          : lodash.createCallback(callback, thisArg, 1);

        result = callback(result);
        if (typeof result != 'undefined') {
          return result;
        }
        result = value;
      }
      // inspect [[Class]]
      var isObj = isObject(result);
      if (isObj) {
        var className = toString.call(result);
        if (!cloneableClasses[className] || (!support.nodeClass && isNode(result))) {
          return result;
        }
        var isArr = isArray(result);
      }
      // shallow clone
      if (!isObj || !deep) {
        return isObj
          ? (isArr ? slice(result) : assign({}, result))
          : result;
      }
      var ctor = ctorByClass[className];
      switch (className) {
        case boolClass:
        case dateClass:
          return new ctor(+result);

        case numberClass:
        case stringClass:
          return new ctor(result);

        case regexpClass:
          return ctor(result.source, reFlags.exec(result));
      }
      // check for circular references and return corresponding clone
      stackA || (stackA = []);
      stackB || (stackB = []);

      var length = stackA.length;
      while (length--) {
        if (stackA[length] == value) {
          return stackB[length];
        }
      }
      // init cloned object
      result = isArr ? ctor(result.length) : {};

      // add array properties assigned by `RegExp#exec`
      if (isArr) {
        if (hasOwnProperty.call(value, 'index')) {
          result.index = value.index;
        }
        if (hasOwnProperty.call(value, 'input')) {
          result.input = value.input;
        }
      }
      // add the source value to the stack of traversed objects
      // and associate it with its clone
      stackA.push(value);
      stackB.push(result);

      // recursively populate clone (susceptible to call stack limits)
      (isArr ? forEach : forOwn)(value, function(objValue, key) {
        result[key] = clone(objValue, deep, callback, undefined, stackA, stackB);
      });

      return result;
    }

    /**
     * Creates a deep clone of `value`. If a `callback` function is passed,
     * it will be executed to produce the cloned values. If `callback` returns
     * `undefined`, cloning will be handled by the method instead. The `callback`
     * is bound to `thisArg` and invoked with one argument; (value).
     *
     * Note: This function is loosely based on the structured clone algorithm. Functions
     * and DOM nodes are **not** cloned. The enumerable properties of `arguments` objects and
     * objects created by constructors other than `Object` are cloned to plain `Object` objects.
     * See http://www.w3.org/TR/html5/infrastructure.html#internal-structured-cloning-algorithm.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Mixed} Returns the deep cloned `value`.
     * @example
     *
     * var stooges = [
     *   { 'name': 'moe', 'age': 40 },
     *   { 'name': 'larry', 'age': 50 }
     * ];
     *
     * var deep = _.cloneDeep(stooges);
     * deep[0] === stooges[0];
     * // => false
     *
     * var view = {
     *   'label': 'docs',
     *   'node': element
     * };
     *
     * var clone = _.cloneDeep(view, function(value) {
     *   return _.isElement(value) ? value.cloneNode(true) : undefined;
     * });
     *
     * clone.node == view.node;
     * // => false
     */
    function cloneDeep(value, callback, thisArg) {
      return clone(value, true, callback, thisArg);
    }

    /**
     * Assigns own enumerable properties of source object(s) to the destination
     * object for all destination properties that resolve to `undefined`. Once a
     * property is set, additional defaults of the same property will be ignored.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The destination object.
     * @param {Object} [source1, source2, ...] The source objects.
     * @param- {Object} [guard] Allows working with `_.reduce` without using its
     *  callback's `key` and `object` arguments as sources.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * var food = { 'name': 'apple' };
     * _.defaults(food, { 'name': 'banana', 'type': 'fruit' });
     * // => { 'name': 'apple', 'type': 'fruit' }
     */
    var defaults = createIterator(defaultsIteratorOptions);

    /**
     * This method is similar to `_.find`, except that it returns the key of the
     * element that passes the callback check, instead of the element itself.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Mixed} Returns the key of the found element, else `undefined`.
     * @example
     *
     * _.findKey({ 'a': 1, 'b': 2, 'c': 3, 'd': 4 }, function(num) { return num % 2 == 0; });
     * // => 'b'
     */
    function findKey(collection, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg);
      forOwn(collection, function(value, key, collection) {
        if (callback(value, key, collection)) {
          result = key;
          return false;
        }
      });
      return result;
    }

    /**
     * Iterates over `object`'s own and inherited enumerable properties, executing
     * the `callback` for each property. The `callback` is bound to `thisArg` and
     * invoked with three arguments; (value, key, object). Callbacks may exit iteration
     * early by explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * function Dog(name) {
     *   this.name = name;
     * }
     *
     * Dog.prototype.bark = function() {
     *   alert('Woof, woof!');
     * };
     *
     * _.forIn(new Dog('Dagny'), function(value, key) {
     *   alert(key);
     * });
     * // => alerts 'name' and 'bark' (order is not guaranteed)
     */
    var forIn = createIterator(eachIteratorOptions, forOwnIteratorOptions, {
      'useHas': false
    });

    /**
     * Iterates over an object's own enumerable properties, executing the `callback`
     * for each property. The `callback` is bound to `thisArg` and invoked with three
     * arguments; (value, key, object). Callbacks may exit iteration early by explicitly
     * returning `false`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * _.forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
     *   alert(key);
     * });
     * // => alerts '0', '1', and 'length' (order is not guaranteed)
     */
    var forOwn = createIterator(eachIteratorOptions, forOwnIteratorOptions);

    /**
     * Creates a sorted array of all enumerable properties, own and inherited,
     * of `object` that have function values.
     *
     * @static
     * @memberOf _
     * @alias methods
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns a new array of property names that have function values.
     * @example
     *
     * _.functions(_);
     * // => ['all', 'any', 'bind', 'bindAll', 'clone', 'compact', 'compose', ...]
     */
    function functions(object) {
      var result = [];
      forIn(object, function(value, key) {
        if (isFunction(value)) {
          result.push(key);
        }
      });
      return result.sort();
    }

    /**
     * Checks if the specified object `property` exists and is a direct property,
     * instead of an inherited property.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to check.
     * @param {String} property The property to check for.
     * @returns {Boolean} Returns `true` if key is a direct property, else `false`.
     * @example
     *
     * _.has({ 'a': 1, 'b': 2, 'c': 3 }, 'b');
     * // => true
     */
    function has(object, property) {
      return object ? hasOwnProperty.call(object, property) : false;
    }

    /**
     * Creates an object composed of the inverted keys and values of the given `object`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to invert.
     * @returns {Object} Returns the created inverted object.
     * @example
     *
     *  _.invert({ 'first': 'moe', 'second': 'larry' });
     * // => { 'moe': 'first', 'larry': 'second' }
     */
    function invert(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = {};

      while (++index < length) {
        var key = props[index];
        result[object[key]] = key;
      }
      return result;
    }

    /**
     * Checks if `value` is a boolean value.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is a boolean value, else `false`.
     * @example
     *
     * _.isBoolean(null);
     * // => false
     */
    function isBoolean(value) {
      return value === true || value === false || toString.call(value) == boolClass;
    }

    /**
     * Checks if `value` is a date.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is a date, else `false`.
     * @example
     *
     * _.isDate(new Date);
     * // => true
     */
    function isDate(value) {
      return value instanceof Date || toString.call(value) == dateClass;
    }

    /**
     * Checks if `value` is a DOM element.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is a DOM element, else `false`.
     * @example
     *
     * _.isElement(document.body);
     * // => true
     */
    function isElement(value) {
      return value ? value.nodeType === 1 : false;
    }

    /**
     * Checks if `value` is empty. Arrays, strings, or `arguments` objects with a
     * length of `0` and objects with no own enumerable properties are considered
     * "empty".
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Array|Object|String} value The value to inspect.
     * @returns {Boolean} Returns `true`, if the `value` is empty, else `false`.
     * @example
     *
     * _.isEmpty([1, 2, 3]);
     * // => false
     *
     * _.isEmpty({});
     * // => true
     *
     * _.isEmpty('');
     * // => true
     */
    function isEmpty(value) {
      var result = true;
      if (!value) {
        return result;
      }
      var className = toString.call(value),
          length = value.length;

      if ((className == arrayClass || className == stringClass ||
          (support.argsClass ? className == argsClass : isArguments(value))) ||
          (className == objectClass && typeof length == 'number' && isFunction(value.splice))) {
        return !length;
      }
      forOwn(value, function() {
        return (result = false);
      });
      return result;
    }

    /**
     * Performs a deep comparison between two values to determine if they are
     * equivalent to each other. If `callback` is passed, it will be executed to
     * compare values. If `callback` returns `undefined`, comparisons will be handled
     * by the method instead. The `callback` is bound to `thisArg` and invoked with
     * two arguments; (a, b).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} a The value to compare.
     * @param {Mixed} b The other value to compare.
     * @param {Function} [callback] The function to customize comparing values.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @param- {Array} [stackA=[]] Tracks traversed `a` objects.
     * @param- {Array} [stackB=[]] Tracks traversed `b` objects.
     * @returns {Boolean} Returns `true`, if the values are equivalent, else `false`.
     * @example
     *
     * var moe = { 'name': 'moe', 'age': 40 };
     * var copy = { 'name': 'moe', 'age': 40 };
     *
     * moe == copy;
     * // => false
     *
     * _.isEqual(moe, copy);
     * // => true
     *
     * var words = ['hello', 'goodbye'];
     * var otherWords = ['hi', 'goodbye'];
     *
     * _.isEqual(words, otherWords, function(a, b) {
     *   var reGreet = /^(?:hello|hi)$/i,
     *       aGreet = _.isString(a) && reGreet.test(a),
     *       bGreet = _.isString(b) && reGreet.test(b);
     *
     *   return (aGreet || bGreet) ? (aGreet == bGreet) : undefined;
     * });
     * // => true
     */
    function isEqual(a, b, callback, thisArg, stackA, stackB) {
      // used to indicate that when comparing objects, `a` has at least the properties of `b`
      var whereIndicator = callback === indicatorObject;
      if (callback && !whereIndicator) {
        callback = (typeof thisArg == 'undefined')
          ? callback
          : lodash.createCallback(callback, thisArg, 2);

        var result = callback(a, b);
        if (typeof result != 'undefined') {
          return !!result;
        }
      }
      // exit early for identical values
      if (a === b) {
        // treat `+0` vs. `-0` as not equal
        return a !== 0 || (1 / a == 1 / b);
      }
      var type = typeof a,
          otherType = typeof b;

      // exit early for unlike primitive values
      if (a === a &&
          (!a || (type != 'function' && type != 'object')) &&
          (!b || (otherType != 'function' && otherType != 'object'))) {
        return false;
      }
      // exit early for `null` and `undefined`, avoiding ES3's Function#call behavior
      // http://es5.github.com/#x15.3.4.4
      if (a == null || b == null) {
        return a === b;
      }
      // compare [[Class]] names
      var className = toString.call(a),
          otherClass = toString.call(b);

      if (className == argsClass) {
        className = objectClass;
      }
      if (otherClass == argsClass) {
        otherClass = objectClass;
      }
      if (className != otherClass) {
        return false;
      }
      switch (className) {
        case boolClass:
        case dateClass:
          // coerce dates and booleans to numbers, dates to milliseconds and booleans
          // to `1` or `0`, treating invalid dates coerced to `NaN` as not equal
          return +a == +b;

        case numberClass:
          // treat `NaN` vs. `NaN` as equal
          return (a != +a)
            ? b != +b
            // but treat `+0` vs. `-0` as not equal
            : (a == 0 ? (1 / a == 1 / b) : a == +b);

        case regexpClass:
        case stringClass:
          // coerce regexes to strings (http://es5.github.com/#x15.10.6.4)
          // treat string primitives and their corresponding object instances as equal
          return a == String(b);
      }
      var isArr = className == arrayClass;
      if (!isArr) {
        // unwrap any `lodash` wrapped values
        if (hasOwnProperty.call(a, '__wrapped__ ') || hasOwnProperty.call(b, '__wrapped__')) {
          return isEqual(a.__wrapped__ || a, b.__wrapped__ || b, callback, thisArg, stackA, stackB);
        }
        // exit for functions and DOM nodes
        if (className != objectClass || (!support.nodeClass && (isNode(a) || isNode(b)))) {
          return false;
        }
        // in older versions of Opera, `arguments` objects have `Array` constructors
        var ctorA = !support.argsObject && isArguments(a) ? Object : a.constructor,
            ctorB = !support.argsObject && isArguments(b) ? Object : b.constructor;

        // non `Object` object instances with different constructors are not equal
        if (ctorA != ctorB && !(
              isFunction(ctorA) && ctorA instanceof ctorA &&
              isFunction(ctorB) && ctorB instanceof ctorB
            )) {
          return false;
        }
      }
      // assume cyclic structures are equal
      // the algorithm for detecting cyclic structures is adapted from ES 5.1
      // section 15.12.3, abstract operation `JO` (http://es5.github.com/#x15.12.3)
      stackA || (stackA = []);
      stackB || (stackB = []);

      var length = stackA.length;
      while (length--) {
        if (stackA[length] == a) {
          return stackB[length] == b;
        }
      }
      var size = 0;
      result = true;

      // add `a` and `b` to the stack of traversed objects
      stackA.push(a);
      stackB.push(b);

      // recursively compare objects and arrays (susceptible to call stack limits)
      if (isArr) {
        length = a.length;
        size = b.length;

        // compare lengths to determine if a deep comparison is necessary
        result = size == a.length;
        if (!result && !whereIndicator) {
          return result;
        }
        // deep compare the contents, ignoring non-numeric properties
        while (size--) {
          var index = length,
              value = b[size];

          if (whereIndicator) {
            while (index--) {
              if ((result = isEqual(a[index], value, callback, thisArg, stackA, stackB))) {
                break;
              }
            }
          } else if (!(result = isEqual(a[size], value, callback, thisArg, stackA, stackB))) {
            break;
          }
        }
        return result;
      }
      // deep compare objects using `forIn`, instead of `forOwn`, to avoid `Object.keys`
      // which, in this case, is more costly
      forIn(b, function(value, key, b) {
        if (hasOwnProperty.call(b, key)) {
          // count the number of properties.
          size++;
          // deep compare each property value.
          return (result = hasOwnProperty.call(a, key) && isEqual(a[key], value, callback, thisArg, stackA, stackB));
        }
      });

      if (result && !whereIndicator) {
        // ensure both objects have the same number of properties
        forIn(a, function(value, key, a) {
          if (hasOwnProperty.call(a, key)) {
            // `size` will be `-1` if `a` has more properties than `b`
            return (result = --size > -1);
          }
        });
      }
      return result;
    }

    /**
     * Checks if `value` is, or can be coerced to, a finite number.
     *
     * Note: This is not the same as native `isFinite`, which will return true for
     * booleans and empty strings. See http://es5.github.com/#x15.1.2.5.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is finite, else `false`.
     * @example
     *
     * _.isFinite(-101);
     * // => true
     *
     * _.isFinite('10');
     * // => true
     *
     * _.isFinite(true);
     * // => false
     *
     * _.isFinite('');
     * // => false
     *
     * _.isFinite(Infinity);
     * // => false
     */
    function isFinite(value) {
      return nativeIsFinite(value) && !nativeIsNaN(parseFloat(value));
    }

    /**
     * Checks if `value` is a function.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is a function, else `false`.
     * @example
     *
     * _.isFunction(_);
     * // => true
     */
    function isFunction(value) {
      return typeof value == 'function';
    }
    // fallback for older versions of Chrome and Safari
    if (isFunction(/x/)) {
      isFunction = function(value) {
        return value instanceof Function || toString.call(value) == funcClass;
      };
    }

    /**
     * Checks if `value` is the language type of Object.
     * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is an object, else `false`.
     * @example
     *
     * _.isObject({});
     * // => true
     *
     * _.isObject([1, 2, 3]);
     * // => true
     *
     * _.isObject(1);
     * // => false
     */
    function isObject(value) {
      // check if the value is the ECMAScript language type of Object
      // http://es5.github.com/#x8
      // and avoid a V8 bug
      // http://code.google.com/p/v8/issues/detail?id=2291
      return value ? objectTypes[typeof value] : false;
    }

    /**
     * Checks if `value` is `NaN`.
     *
     * Note: This is not the same as native `isNaN`, which will return `true` for
     * `undefined` and other values. See http://es5.github.com/#x15.1.2.4.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is `NaN`, else `false`.
     * @example
     *
     * _.isNaN(NaN);
     * // => true
     *
     * _.isNaN(new Number(NaN));
     * // => true
     *
     * isNaN(undefined);
     * // => true
     *
     * _.isNaN(undefined);
     * // => false
     */
    function isNaN(value) {
      // `NaN` as a primitive is the only value that is not equal to itself
      // (perform the [[Class]] check first to avoid errors with some host objects in IE)
      return isNumber(value) && value != +value
    }

    /**
     * Checks if `value` is `null`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is `null`, else `false`.
     * @example
     *
     * _.isNull(null);
     * // => true
     *
     * _.isNull(undefined);
     * // => false
     */
    function isNull(value) {
      return value === null;
    }

    /**
     * Checks if `value` is a number.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is a number, else `false`.
     * @example
     *
     * _.isNumber(8.4 * 5);
     * // => true
     */
    function isNumber(value) {
      return typeof value == 'number' || toString.call(value) == numberClass;
    }

    /**
     * Checks if a given `value` is an object created by the `Object` constructor.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if `value` is a plain object, else `false`.
     * @example
     *
     * function Stooge(name, age) {
     *   this.name = name;
     *   this.age = age;
     * }
     *
     * _.isPlainObject(new Stooge('moe', 40));
     * // => false
     *
     * _.isPlainObject([1, 2, 3]);
     * // => false
     *
     * _.isPlainObject({ 'name': 'moe', 'age': 40 });
     * // => true
     */
    var isPlainObject = !getPrototypeOf ? shimIsPlainObject : function(value) {
      if (!(value && toString.call(value) == objectClass) || (!support.argsClass && isArguments(value))) {
        return false;
      }
      var valueOf = value.valueOf,
          objProto = typeof valueOf == 'function' && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);

      return objProto
        ? (value == objProto || getPrototypeOf(value) == objProto)
        : shimIsPlainObject(value);
    };

    /**
     * Checks if `value` is a regular expression.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is a regular expression, else `false`.
     * @example
     *
     * _.isRegExp(/moe/);
     * // => true
     */
    function isRegExp(value) {
      return value instanceof RegExp || toString.call(value) == regexpClass;
    }

    /**
     * Checks if `value` is a string.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is a string, else `false`.
     * @example
     *
     * _.isString('moe');
     * // => true
     */
    function isString(value) {
      return typeof value == 'string' || toString.call(value) == stringClass;
    }

    /**
     * Checks if `value` is `undefined`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Mixed} value The value to check.
     * @returns {Boolean} Returns `true`, if the `value` is `undefined`, else `false`.
     * @example
     *
     * _.isUndefined(void 0);
     * // => true
     */
    function isUndefined(value) {
      return typeof value == 'undefined';
    }

    /**
     * Recursively merges own enumerable properties of the source object(s), that
     * don't resolve to `undefined`, into the destination object. Subsequent sources
     * will overwrite property assignments of previous sources. If a `callback` function
     * is passed, it will be executed to produce the merged values of the destination
     * and source properties. If `callback` returns `undefined`, merging will be
     * handled by the method instead. The `callback` is bound to `thisArg` and
     * invoked with two arguments; (objectValue, sourceValue).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The destination object.
     * @param {Object} [source1, source2, ...] The source objects.
     * @param {Function} [callback] The function to customize merging properties.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @param- {Object} [deepIndicator] Indicates that `stackA` and `stackB` are
     *  arrays of traversed objects, instead of source objects.
     * @param- {Array} [stackA=[]] Tracks traversed source objects.
     * @param- {Array} [stackB=[]] Associates values with source counterparts.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * var names = {
     *   'stooges': [
     *     { 'name': 'moe' },
     *     { 'name': 'larry' }
     *   ]
     * };
     *
     * var ages = {
     *   'stooges': [
     *     { 'age': 40 },
     *     { 'age': 50 }
     *   ]
     * };
     *
     * _.merge(names, ages);
     * // => { 'stooges': [{ 'name': 'moe', 'age': 40 }, { 'name': 'larry', 'age': 50 }] }
     *
     * var food = {
     *   'fruits': ['apple'],
     *   'vegetables': ['beet']
     * };
     *
     * var otherFood = {
     *   'fruits': ['banana'],
     *   'vegetables': ['carrot']
     * };
     *
     * _.merge(food, otherFood, function(a, b) {
     *   return _.isArray(a) ? a.concat(b) : undefined;
     * });
     * // => { 'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot] }
     */
    function merge(object, source, deepIndicator) {
      var args = arguments,
          index = 0,
          length = 2;

      if (!isObject(object)) {
        return object;
      }
      if (deepIndicator === indicatorObject) {
        var callback = args[3],
            stackA = args[4],
            stackB = args[5];
      } else {
        stackA = [];
        stackB = [];

        // allows working with `_.reduce` and `_.reduceRight` without
        // using their `callback` arguments, `index|key` and `collection`
        if (typeof deepIndicator != 'number') {
          length = args.length;
        }
        if (length > 3 && typeof args[length - 2] == 'function') {
          callback = lodash.createCallback(args[--length - 1], args[length--], 2);
        } else if (length > 2 && typeof args[length - 1] == 'function') {
          callback = args[--length];
        }
      }
      while (++index < length) {
        (isArray(args[index]) ? forEach : forOwn)(args[index], function(source, key) {
          var found,
              isArr,
              result = source,
              value = object[key];

          if (source && ((isArr = isArray(source)) || isPlainObject(source))) {
            // avoid merging previously merged cyclic sources
            var stackLength = stackA.length;
            while (stackLength--) {
              if ((found = stackA[stackLength] == source)) {
                value = stackB[stackLength];
                break;
              }
            }
            if (!found) {
              value = isArr
                ? (isArray(value) ? value : [])
                : (isPlainObject(value) ? value : {});

              if (callback) {
                result = callback(value, source);
                if (typeof result != 'undefined') {
                  value = result;
                }
              }
              // add `source` and associated `value` to the stack of traversed objects
              stackA.push(source);
              stackB.push(value);

              // recursively merge objects and arrays (susceptible to call stack limits)
              if (!callback) {
                value = merge(value, source, indicatorObject, callback, stackA, stackB);
              }
            }
          }
          else {
            if (callback) {
              result = callback(value, source);
              if (typeof result == 'undefined') {
                result = source;
              }
            }
            if (typeof result != 'undefined') {
              value = result;
            }
          }
          object[key] = value;
        });
      }
      return object;
    }

    /**
     * Creates a shallow clone of `object` excluding the specified properties.
     * Property names may be specified as individual arguments or as arrays of
     * property names. If a `callback` function is passed, it will be executed
     * for each property in the `object`, omitting the properties `callback`
     * returns truthy for. The `callback` is bound to `thisArg` and invoked
     * with three arguments; (value, key, object).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The source object.
     * @param {Function|String} callback|[prop1, prop2, ...] The properties to omit
     *  or the function called per iteration.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns an object without the omitted properties.
     * @example
     *
     * _.omit({ 'name': 'moe', 'age': 40 }, 'age');
     * // => { 'name': 'moe' }
     *
     * _.omit({ 'name': 'moe', 'age': 40 }, function(value) {
     *   return typeof value == 'number';
     * });
     * // => { 'name': 'moe' }
     */
    function omit(object, callback, thisArg) {
      var isFunc = typeof callback == 'function',
          result = {};

      if (isFunc) {
        callback = lodash.createCallback(callback, thisArg);
      } else {
        var props = concat.apply(arrayRef, arguments);
      }
      forIn(object, function(value, key, object) {
        if (isFunc
              ? !callback(value, key, object)
              : indexOf(props, key, 1) < 0
            ) {
          result[key] = value;
        }
      });
      return result;
    }

    /**
     * Creates a two dimensional array of the given object's key-value pairs,
     * i.e. `[[key1, value1], [key2, value2]]`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns new array of key-value pairs.
     * @example
     *
     * _.pairs({ 'moe': 30, 'larry': 40 });
     * // => [['moe', 30], ['larry', 40]] (order is not guaranteed)
     */
    function pairs(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

      while (++index < length) {
        var key = props[index];
        result[index] = [key, object[key]];
      }
      return result;
    }

    /**
     * Creates a shallow clone of `object` composed of the specified properties.
     * Property names may be specified as individual arguments or as arrays of property
     * names. If `callback` is passed, it will be executed for each property in the
     * `object`, picking the properties `callback` returns truthy for. The `callback`
     * is bound to `thisArg` and invoked with three arguments; (value, key, object).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The source object.
     * @param {Array|Function|String} callback|[prop1, prop2, ...] The function called
     *  per iteration or properties to pick, either as individual arguments or arrays.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns an object composed of the picked properties.
     * @example
     *
     * _.pick({ 'name': 'moe', '_userid': 'moe1' }, 'name');
     * // => { 'name': 'moe' }
     *
     * _.pick({ 'name': 'moe', '_userid': 'moe1' }, function(value, key) {
     *   return key.charAt(0) != '_';
     * });
     * // => { 'name': 'moe' }
     */
    function pick(object, callback, thisArg) {
      var result = {};
      if (typeof callback != 'function') {
        var index = 0,
            props = concat.apply(arrayRef, arguments),
            length = isObject(object) ? props.length : 0;

        while (++index < length) {
          var key = props[index];
          if (key in object) {
            result[key] = object[key];
          }
        }
      } else {
        callback = lodash.createCallback(callback, thisArg);
        forIn(object, function(value, key, object) {
          if (callback(value, key, object)) {
            result[key] = value;
          }
        });
      }
      return result;
    }

    /**
     * Creates an array composed of the own enumerable property values of `object`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns a new array of property values.
     * @example
     *
     * _.values({ 'one': 1, 'two': 2, 'three': 3 });
     * // => [1, 2, 3] (order is not guaranteed)
     */
    function values(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

      while (++index < length) {
        result[index] = object[props[index]];
      }
      return result;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates an array of elements from the specified indexes, or keys, of the
     * `collection`. Indexes may be specified as individual arguments or as arrays
     * of indexes.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Array|Number|String} [index1, index2, ...] The indexes of
     *  `collection` to retrieve, either as individual arguments or arrays.
     * @returns {Array} Returns a new array of elements corresponding to the
     *  provided indexes.
     * @example
     *
     * _.at(['a', 'b', 'c', 'd', 'e'], [0, 2, 4]);
     * // => ['a', 'c', 'e']
     *
     * _.at(['moe', 'larry', 'curly'], 0, 2);
     * // => ['moe', 'curly']
     */
    function at(collection) {
      var index = -1,
          props = concat.apply(arrayRef, slice(arguments, 1)),
          length = props.length,
          result = Array(length);

      if (support.unindexedChars && isString(collection)) {
        collection = collection.split('');
      }
      while(++index < length) {
        result[index] = collection[props[index]];
      }
      return result;
    }

    /**
     * Checks if a given `target` element is present in a `collection` using strict
     * equality for comparisons, i.e. `===`. If `fromIndex` is negative, it is used
     * as the offset from the end of the collection.
     *
     * @static
     * @memberOf _
     * @alias include
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Mixed} target The value to check for.
     * @param {Number} [fromIndex=0] The index to search from.
     * @returns {Boolean} Returns `true` if the `target` element is found, else `false`.
     * @example
     *
     * _.contains([1, 2, 3], 1);
     * // => true
     *
     * _.contains([1, 2, 3], 1, 2);
     * // => false
     *
     * _.contains({ 'name': 'moe', 'age': 40 }, 'moe');
     * // => true
     *
     * _.contains('curly', 'ur');
     * // => true
     */
    function contains(collection, target, fromIndex) {
      var index = -1,
          length = collection ? collection.length : 0,
          result = false;

      fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex) || 0;
      if (typeof length == 'number') {
        result = (isString(collection)
          ? collection.indexOf(target, fromIndex)
          : indexOf(collection, target, fromIndex)
        ) > -1;
      } else {
        each(collection, function(value) {
          if (++index >= fromIndex) {
            return !(result = value === target);
          }
        });
      }
      return result;
    }

    /**
     * Creates an object composed of keys returned from running each element of the
     * `collection` through the given `callback`. The corresponding value of each key
     * is the number of times the key was returned by the `callback`. The `callback`
     * is bound to `thisArg` and invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * _.countBy([4.3, 6.1, 6.4], function(num) { return Math.floor(num); });
     * // => { '4': 1, '6': 2 }
     *
     * _.countBy([4.3, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
     * // => { '4': 1, '6': 2 }
     *
     * _.countBy(['one', 'two', 'three'], 'length');
     * // => { '3': 2, '5': 1 }
     */
    function countBy(collection, callback, thisArg) {
      var result = {};
      callback = lodash.createCallback(callback, thisArg);

      forEach(collection, function(value, key, collection) {
        key = String(callback(value, key, collection));
        (hasOwnProperty.call(result, key) ? result[key]++ : result[key] = 1);
      });
      return result;
    }

    /**
     * Checks if the `callback` returns a truthy value for **all** elements of a
     * `collection`. The `callback` is bound to `thisArg` and invoked with three
     * arguments; (value, index|key, collection).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias all
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Boolean} Returns `true` if all elements pass the callback check,
     *  else `false`.
     * @example
     *
     * _.every([true, 1, null, 'yes'], Boolean);
     * // => false
     *
     * var stooges = [
     *   { 'name': 'moe', 'age': 40 },
     *   { 'name': 'larry', 'age': 50 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.every(stooges, 'age');
     * // => true
     *
     * // using "_.where" callback shorthand
     * _.every(stooges, { 'age': 50 });
     * // => false
     */
    function every(collection, callback, thisArg) {
      var result = true;
      callback = lodash.createCallback(callback, thisArg);

      if (isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          if (!(result = !!callback(collection[index], index, collection))) {
            break;
          }
        }
      } else {
        each(collection, function(value, index, collection) {
          return (result = !!callback(value, index, collection));
        });
      }
      return result;
    }

    /**
     * Examines each element in a `collection`, returning an array of all elements
     * the `callback` returns truthy for. The `callback` is bound to `thisArg` and
     * invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias select
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of elements that passed the callback check.
     * @example
     *
     * var evens = _.filter([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
     * // => [2, 4, 6]
     *
     * var food = [
     *   { 'name': 'apple',  'organic': false, 'type': 'fruit' },
     *   { 'name': 'carrot', 'organic': true,  'type': 'vegetable' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.filter(food, 'organic');
     * // => [{ 'name': 'carrot', 'organic': true, 'type': 'vegetable' }]
     *
     * // using "_.where" callback shorthand
     * _.filter(food, { 'type': 'fruit' });
     * // => [{ 'name': 'apple', 'organic': false, 'type': 'fruit' }]
     */
    function filter(collection, callback, thisArg) {
      var result = [];
      callback = lodash.createCallback(callback, thisArg);

      if (isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (callback(value, index, collection)) {
            result.push(value);
          }
        }
      } else {
        each(collection, function(value, index, collection) {
          if (callback(value, index, collection)) {
            result.push(value);
          }
        });
      }
      return result;
    }

    /**
     * Examines each element in a `collection`, returning the first that the `callback`
     * returns truthy for. The `callback` is bound to `thisArg` and invoked with three
     * arguments; (value, index|key, collection).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias detect
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Mixed} Returns the found element, else `undefined`.
     * @example
     *
     * _.find([1, 2, 3, 4], function(num) { return num % 2 == 0; });
     * // => 2
     *
     * var food = [
     *   { 'name': 'apple',  'organic': false, 'type': 'fruit' },
     *   { 'name': 'banana', 'organic': true,  'type': 'fruit' },
     *   { 'name': 'beet',   'organic': false, 'type': 'vegetable' }
     * ];
     *
     * // using "_.where" callback shorthand
     * _.find(food, { 'type': 'vegetable' });
     * // => { 'name': 'beet', 'organic': false, 'type': 'vegetable' }
     *
     * // using "_.pluck" callback shorthand
     * _.find(food, 'organic');
     * // => { 'name': 'banana', 'organic': true, 'type': 'fruit' }
     */
    function find(collection, callback, thisArg) {
      callback = lodash.createCallback(callback, thisArg);

      if (isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (callback(value, index, collection)) {
            return value;
          }
        }
      } else {
        var result;
        each(collection, function(value, index, collection) {
          if (callback(value, index, collection)) {
            result = value;
            return false;
          }
        });
        return result;
      }
    }

    /**
     * Iterates over a `collection`, executing the `callback` for each element in
     * the `collection`. The `callback` is bound to `thisArg` and invoked with three
     * arguments; (value, index|key, collection). Callbacks may exit iteration early
     * by explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @alias each
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Array|Object|String} Returns `collection`.
     * @example
     *
     * _([1, 2, 3]).forEach(alert).join(',');
     * // => alerts each number and returns '1,2,3'
     *
     * _.forEach({ 'one': 1, 'two': 2, 'three': 3 }, alert);
     * // => alerts each number value (order is not guaranteed)
     */
    function forEach(collection, callback, thisArg) {
      if (callback && typeof thisArg == 'undefined' && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          if (callback(collection[index], index, collection) === false) {
            break;
          }
        }
      } else {
        each(collection, callback, thisArg);
      }
      return collection;
    }

    /**
     * Creates an object composed of keys returned from running each element of the
     * `collection` through the `callback`. The corresponding value of each key is
     * an array of elements passed to `callback` that returned the key. The `callback`
     * is bound to `thisArg` and invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * _.groupBy([4.2, 6.1, 6.4], function(num) { return Math.floor(num); });
     * // => { '4': [4.2], '6': [6.1, 6.4] }
     *
     * _.groupBy([4.2, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
     * // => { '4': [4.2], '6': [6.1, 6.4] }
     *
     * // using "_.pluck" callback shorthand
     * _.groupBy(['one', 'two', 'three'], 'length');
     * // => { '3': ['one', 'two'], '5': ['three'] }
     */
    function groupBy(collection, callback, thisArg) {
      var result = {};
      callback = lodash.createCallback(callback, thisArg);

      forEach(collection, function(value, key, collection) {
        key = String(callback(value, key, collection));
        (hasOwnProperty.call(result, key) ? result[key] : result[key] = []).push(value);
      });
      return result;
    }

    /**
     * Invokes the method named by `methodName` on each element in the `collection`,
     * returning an array of the results of each invoked method. Additional arguments
     * will be passed to each invoked method. If `methodName` is a function, it will
     * be invoked for, and `this` bound to, each element in the `collection`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|String} methodName The name of the method to invoke or
     *  the function invoked per iteration.
     * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the method with.
     * @returns {Array} Returns a new array of the results of each invoked method.
     * @example
     *
     * _.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
     * // => [[1, 5, 7], [1, 2, 3]]
     *
     * _.invoke([123, 456], String.prototype.split, '');
     * // => [['1', '2', '3'], ['4', '5', '6']]
     */
    function invoke(collection, methodName) {
      var args = slice(arguments, 2),
          index = -1,
          isFunc = typeof methodName == 'function',
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      forEach(collection, function(value) {
        result[++index] = (isFunc ? methodName : value[methodName]).apply(value, args);
      });
      return result;
    }

    /**
     * Creates an array of values by running each element in the `collection`
     * through the `callback`. The `callback` is bound to `thisArg` and invoked with
     * three arguments; (value, index|key, collection).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias collect
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of the results of each `callback` execution.
     * @example
     *
     * _.map([1, 2, 3], function(num) { return num * 3; });
     * // => [3, 6, 9]
     *
     * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { return num * 3; });
     * // => [3, 6, 9] (order is not guaranteed)
     *
     * var stooges = [
     *   { 'name': 'moe', 'age': 40 },
     *   { 'name': 'larry', 'age': 50 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.map(stooges, 'name');
     * // => ['moe', 'larry']
     */
    function map(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      callback = lodash.createCallback(callback, thisArg);
      if (isArray(collection)) {
        while (++index < length) {
          result[index] = callback(collection[index], index, collection);
        }
      } else {
        each(collection, function(value, key, collection) {
          result[++index] = callback(value, key, collection);
        });
      }
      return result;
    }

    /**
     * Retrieves the maximum value of an `array`. If `callback` is passed,
     * it will be executed for each value in the `array` to generate the
     * criterion by which the value is ranked. The `callback` is bound to
     * `thisArg` and invoked with three arguments; (value, index, collection).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Mixed} Returns the maximum value.
     * @example
     *
     * _.max([4, 2, 8, 6]);
     * // => 8
     *
     * var stooges = [
     *   { 'name': 'moe', 'age': 40 },
     *   { 'name': 'larry', 'age': 50 }
     * ];
     *
     * _.max(stooges, function(stooge) { return stooge.age; });
     * // => { 'name': 'larry', 'age': 50 };
     *
     * // using "_.pluck" callback shorthand
     * _.max(stooges, 'age');
     * // => { 'name': 'larry', 'age': 50 };
     */
    function max(collection, callback, thisArg) {
      var computed = -Infinity,
          result = computed;

      if (!callback && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (value > result) {
            result = value;
          }
        }
      } else {
        callback = (!callback && isString(collection))
          ? charAtCallback
          : lodash.createCallback(callback, thisArg);

        each(collection, function(value, index, collection) {
          var current = callback(value, index, collection);
          if (current > computed) {
            computed = current;
            result = value;
          }
        });
      }
      return result;
    }

    /**
     * Retrieves the minimum value of an `array`. If `callback` is passed,
     * it will be executed for each value in the `array` to generate the
     * criterion by which the value is ranked. The `callback` is bound to `thisArg`
     * and invoked with three arguments; (value, index, collection).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Mixed} Returns the minimum value.
     * @example
     *
     * _.min([4, 2, 8, 6]);
     * // => 2
     *
     * var stooges = [
     *   { 'name': 'moe', 'age': 40 },
     *   { 'name': 'larry', 'age': 50 }
     * ];
     *
     * _.min(stooges, function(stooge) { return stooge.age; });
     * // => { 'name': 'moe', 'age': 40 };
     *
     * // using "_.pluck" callback shorthand
     * _.min(stooges, 'age');
     * // => { 'name': 'moe', 'age': 40 };
     */
    function min(collection, callback, thisArg) {
      var computed = Infinity,
          result = computed;

      if (!callback && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (value < result) {
            result = value;
          }
        }
      } else {
        callback = (!callback && isString(collection))
          ? charAtCallback
          : lodash.createCallback(callback, thisArg);

        each(collection, function(value, index, collection) {
          var current = callback(value, index, collection);
          if (current < computed) {
            computed = current;
            result = value;
          }
        });
      }
      return result;
    }

    /**
     * Retrieves the value of a specified property from all elements in the `collection`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {String} property The property to pluck.
     * @returns {Array} Returns a new array of property values.
     * @example
     *
     * var stooges = [
     *   { 'name': 'moe', 'age': 40 },
     *   { 'name': 'larry', 'age': 50 }
     * ];
     *
     * _.pluck(stooges, 'name');
     * // => ['moe', 'larry']
     */
    var pluck = map;

    /**
     * Reduces a `collection` to a value that is the accumulated result of running
     * each element in the `collection` through the `callback`, where each successive
     * `callback` execution consumes the return value of the previous execution.
     * If `accumulator` is not passed, the first element of the `collection` will be
     * used as the initial `accumulator` value. The `callback` is bound to `thisArg`
     * and invoked with four arguments; (accumulator, value, index|key, collection).
     *
     * @static
     * @memberOf _
     * @alias foldl, inject
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {Mixed} [accumulator] Initial value of the accumulator.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Mixed} Returns the accumulated value.
     * @example
     *
     * var sum = _.reduce([1, 2, 3], function(sum, num) {
     *   return sum + num;
     * });
     * // => 6
     *
     * var mapped = _.reduce({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
     *   result[key] = num * 3;
     *   return result;
     * }, {});
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     */
    function reduce(collection, callback, accumulator, thisArg) {
      var noaccum = arguments.length < 3;
      callback = lodash.createCallback(callback, thisArg, 4);

      if (isArray(collection)) {
        var index = -1,
            length = collection.length;

        if (noaccum) {
          accumulator = collection[++index];
        }
        while (++index < length) {
          accumulator = callback(accumulator, collection[index], index, collection);
        }
      } else {
        each(collection, function(value, index, collection) {
          accumulator = noaccum
            ? (noaccum = false, value)
            : callback(accumulator, value, index, collection)
        });
      }
      return accumulator;
    }

    /**
     * This method is similar to `_.reduce`, except that it iterates over a
     * `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @alias foldr
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {Mixed} [accumulator] Initial value of the accumulator.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Mixed} Returns the accumulated value.
     * @example
     *
     * var list = [[0, 1], [2, 3], [4, 5]];
     * var flat = _.reduceRight(list, function(a, b) { return a.concat(b); }, []);
     * // => [4, 5, 2, 3, 0, 1]
     */
    function reduceRight(collection, callback, accumulator, thisArg) {
      var iterable = collection,
          length = collection ? collection.length : 0,
          noaccum = arguments.length < 3;

      if (typeof length != 'number') {
        var props = keys(collection);
        length = props.length;
      } else if (support.unindexedChars && isString(collection)) {
        iterable = collection.split('');
      }
      callback = lodash.createCallback(callback, thisArg, 4);
      forEach(collection, function(value, index, collection) {
        index = props ? props[--length] : --length;
        accumulator = noaccum
          ? (noaccum = false, iterable[index])
          : callback(accumulator, iterable[index], index, collection);
      });
      return accumulator;
    }

    /**
     * The opposite of `_.filter`, this method returns the elements of a
     * `collection` that `callback` does **not** return truthy for.
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of elements that did **not** pass the
     *  callback check.
     * @example
     *
     * var odds = _.reject([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
     * // => [1, 3, 5]
     *
     * var food = [
     *   { 'name': 'apple',  'organic': false, 'type': 'fruit' },
     *   { 'name': 'carrot', 'organic': true,  'type': 'vegetable' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.reject(food, 'organic');
     * // => [{ 'name': 'apple', 'organic': false, 'type': 'fruit' }]
     *
     * // using "_.where" callback shorthand
     * _.reject(food, { 'type': 'fruit' });
     * // => [{ 'name': 'carrot', 'organic': true, 'type': 'vegetable' }]
     */
    function reject(collection, callback, thisArg) {
      callback = lodash.createCallback(callback, thisArg);
      return filter(collection, function(value, index, collection) {
        return !callback(value, index, collection);
      });
    }

    /**
     * Creates an array of shuffled `array` values, using a version of the
     * Fisher-Yates shuffle. See http://en.wikipedia.org/wiki/Fisher-Yates_shuffle.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|String} collection The collection to shuffle.
     * @returns {Array} Returns a new shuffled collection.
     * @example
     *
     * _.shuffle([1, 2, 3, 4, 5, 6]);
     * // => [4, 1, 6, 3, 5, 2]
     */
    function shuffle(collection) {
      var index = -1,
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      forEach(collection, function(value) {
        var rand = floor(nativeRandom() * (++index + 1));
        result[index] = result[rand];
        result[rand] = value;
      });
      return result;
    }

    /**
     * Gets the size of the `collection` by returning `collection.length` for arrays
     * and array-like objects or the number of own enumerable properties for objects.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|String} collection The collection to inspect.
     * @returns {Number} Returns `collection.length` or number of own enumerable properties.
     * @example
     *
     * _.size([1, 2]);
     * // => 2
     *
     * _.size({ 'one': 1, 'two': 2, 'three': 3 });
     * // => 3
     *
     * _.size('curly');
     * // => 5
     */
    function size(collection) {
      var length = collection ? collection.length : 0;
      return typeof length == 'number' ? length : keys(collection).length;
    }

    /**
     * Checks if the `callback` returns a truthy value for **any** element of a
     * `collection`. The function returns as soon as it finds passing value, and
     * does not iterate over the entire `collection`. The `callback` is bound to
     * `thisArg` and invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias any
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Boolean} Returns `true` if any element passes the callback check,
     *  else `false`.
     * @example
     *
     * _.some([null, 0, 'yes', false], Boolean);
     * // => true
     *
     * var food = [
     *   { 'name': 'apple',  'organic': false, 'type': 'fruit' },
     *   { 'name': 'carrot', 'organic': true,  'type': 'vegetable' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.some(food, 'organic');
     * // => true
     *
     * // using "_.where" callback shorthand
     * _.some(food, { 'type': 'meat' });
     * // => false
     */
    function some(collection, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg);

      if (isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          if ((result = callback(collection[index], index, collection))) {
            break;
          }
        }
      } else {
        each(collection, function(value, index, collection) {
          return !(result = callback(value, index, collection));
        });
      }
      return !!result;
    }

    /**
     * Creates an array of elements, sorted in ascending order by the results of
     * running each element in the `collection` through the `callback`. This method
     * performs a stable sort, that is, it will preserve the original sort order of
     * equal elements. The `callback` is bound to `thisArg` and invoked with three
     * arguments; (value, index|key, collection).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of sorted elements.
     * @example
     *
     * _.sortBy([1, 2, 3], function(num) { return Math.sin(num); });
     * // => [3, 1, 2]
     *
     * _.sortBy([1, 2, 3], function(num) { return this.sin(num); }, Math);
     * // => [3, 1, 2]
     *
     * // using "_.pluck" callback shorthand
     * _.sortBy(['banana', 'strawberry', 'apple'], 'length');
     * // => ['apple', 'banana', 'strawberry']
     */
    function sortBy(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      callback = lodash.createCallback(callback, thisArg);
      forEach(collection, function(value, key, collection) {
        result[++index] = {
          'criteria': callback(value, key, collection),
          'index': index,
          'value': value
        };
      });

      length = result.length;
      result.sort(compareAscending);
      while (length--) {
        result[length] = result[length].value;
      }
      return result;
    }

    /**
     * Converts the `collection` to an array.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|String} collection The collection to convert.
     * @returns {Array} Returns the new converted array.
     * @example
     *
     * (function() { return _.toArray(arguments).slice(1); })(1, 2, 3, 4);
     * // => [2, 3, 4]
     */
    function toArray(collection) {
      if (collection && typeof collection.length == 'number') {
        return (support.unindexedChars && isString(collection))
          ? collection.split('')
          : slice(collection);
      }
      return values(collection);
    }

    /**
     * Examines each element in a `collection`, returning an array of all elements
     * that have the given `properties`. When checking `properties`, this method
     * performs a deep comparison between values to determine if they are equivalent
     * to each other.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Collections
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Object} properties The object of property values to filter by.
     * @returns {Array} Returns a new array of elements that have the given `properties`.
     * @example
     *
     * var stooges = [
     *   { 'name': 'moe', 'age': 40 },
     *   { 'name': 'larry', 'age': 50 }
     * ];
     *
     * _.where(stooges, { 'age': 40 });
     * // => [{ 'name': 'moe', 'age': 40 }]
     */
    var where = filter;

    /*--------------------------------------------------------------------------*/

    /**
     * Creates an array with all falsey values of `array` removed. The values
     * `false`, `null`, `0`, `""`, `undefined` and `NaN` are all falsey.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to compact.
     * @returns {Array} Returns a new filtered array.
     * @example
     *
     * _.compact([0, 1, false, 2, '', 3]);
     * // => [1, 2, 3]
     */
    function compact(array) {
      var index = -1,
          length = array ? array.length : 0,
          result = [];

      while (++index < length) {
        var value = array[index];
        if (value) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * Creates an array of `array` elements not present in the other arrays
     * using strict equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to process.
     * @param {Array} [array1, array2, ...] Arrays to check.
     * @returns {Array} Returns a new array of `array` elements not present in the
     *  other arrays.
     * @example
     *
     * _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
     * // => [1, 3, 4]
     */
    function difference(array) {
      var index = -1,
          length = array ? array.length : 0,
          flattened = concat.apply(arrayRef, arguments),
          contains = cachedContains(flattened, length, 100),
          result = [];

      while (++index < length) {
        var value = array[index];
        if (!contains(value)) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * This method is similar to `_.find`, except that it returns the index of
     * the element that passes the callback check, instead of the element itself.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array|Object|String} collection The collection to iterate over.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Mixed} Returns the index of the found element, else `-1`.
     * @example
     *
     * _.findIndex(['apple', 'banana', 'beet'], function(food) { return /^b/.test(food); });
     * // => 1
     */
    function findIndex(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0;

      callback = lodash.createCallback(callback, thisArg);
      while (++index < length) {
        if (callback(collection[index], index, collection)) {
          return index;
        }
      }
      return -1;
    }

    /**
     * Gets the first element of the `array`. If a number `n` is passed, the first
     * `n` elements of the `array` are returned. If a `callback` function is passed,
     * elements at the beginning of the array are returned as long as the `callback`
     * returns truthy. The `callback` is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias head, take
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|Number|String} [callback|n] The function called
     *  per element or the number of elements to return. If a property name or
     *  object is passed, it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Mixed} Returns the first element(s) of `array`.
     * @example
     *
     * _.first([1, 2, 3]);
     * // => 1
     *
     * _.first([1, 2, 3], 2);
     * // => [1, 2]
     *
     * _.first([1, 2, 3], function(num) {
     *   return num < 3;
     * });
     * // => [1, 2]
     *
     * var food = [
     *   { 'name': 'banana', 'organic': true },
     *   { 'name': 'beet',   'organic': false },
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.first(food, 'organic');
     * // => [{ 'name': 'banana', 'organic': true }]
     *
     * var food = [
     *   { 'name': 'apple',  'type': 'fruit' },
     *   { 'name': 'banana', 'type': 'fruit' },
     *   { 'name': 'beet',   'type': 'vegetable' }
     * ];
     *
     * // using "_.where" callback shorthand
     * _.first(food, { 'type': 'fruit' });
     * // => [{ 'name': 'apple', 'type': 'fruit' }, { 'name': 'banana', 'type': 'fruit' }]
     */
    function first(array, callback, thisArg) {
      if (array) {
        var n = 0,
            length = array.length;

        if (typeof callback != 'number' && callback != null) {
          var index = -1;
          callback = lodash.createCallback(callback, thisArg);
          while (++index < length && callback(array[index], index, array)) {
            n++;
          }
        } else {
          n = callback;
          if (n == null || thisArg) {
            return array[0];
          }
        }
        return slice(array, 0, nativeMin(nativeMax(0, n), length));
      }
    }

    /**
     * Flattens a nested array (the nesting can be to any depth). If `isShallow`
     * is truthy, `array` will only be flattened a single level. If `callback`
     * is passed, each element of `array` is passed through a callback` before
     * flattening. The `callback` is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to compact.
     * @param {Boolean} [isShallow=false] A flag to indicate only flattening a single level.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new flattened array.
     * @example
     *
     * _.flatten([1, [2], [3, [[4]]]]);
     * // => [1, 2, 3, 4];
     *
     * _.flatten([1, [2], [3, [[4]]]], true);
     * // => [1, 2, 3, [[4]]];
     *
     * var stooges = [
     *   { 'name': 'curly', 'quotes': ['Oh, a wise guy, eh?', 'Poifect!'] },
     *   { 'name': 'moe', 'quotes': ['Spread out!', 'You knucklehead!'] }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.flatten(stooges, 'quotes');
     * // => ['Oh, a wise guy, eh?', 'Poifect!', 'Spread out!', 'You knucklehead!']
     */
    function flatten(array, isShallow, callback, thisArg) {
      var index = -1,
          length = array ? array.length : 0,
          result = [];

      // juggle arguments
      if (typeof isShallow != 'boolean' && isShallow != null) {
        thisArg = callback;
        callback = isShallow;
        isShallow = false;
      }
      if (callback != null) {
        callback = lodash.createCallback(callback, thisArg);
      }
      while (++index < length) {
        var value = array[index];
        if (callback) {
          value = callback(value, index, array);
        }
        // recursively flatten arrays (susceptible to call stack limits)
        if (isArray(value)) {
          push.apply(result, isShallow ? value : flatten(value));
        } else {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * Gets the index at which the first occurrence of `value` is found using
     * strict equality for comparisons, i.e. `===`. If the `array` is already
     * sorted, passing `true` for `fromIndex` will run a faster binary search.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {Mixed} value The value to search for.
     * @param {Boolean|Number} [fromIndex=0] The index to search from or `true` to
     *  perform a binary search on a sorted `array`.
     * @returns {Number} Returns the index of the matched value or `-1`.
     * @example
     *
     * _.indexOf([1, 2, 3, 1, 2, 3], 2);
     * // => 1
     *
     * _.indexOf([1, 2, 3, 1, 2, 3], 2, 3);
     * // => 4
     *
     * _.indexOf([1, 1, 2, 2, 3, 3], 2, true);
     * // => 2
     */
    function indexOf(array, value, fromIndex) {
      var index = -1,
          length = array ? array.length : 0;

      if (typeof fromIndex == 'number') {
        index = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex || 0) - 1;
      } else if (fromIndex) {
        index = sortedIndex(array, value);
        return array[index] === value ? index : -1;
      }
      while (++index < length) {
        if (array[index] === value) {
          return index;
        }
      }
      return -1;
    }

    /**
     * Gets all but the last element of `array`. If a number `n` is passed, the
     * last `n` elements are excluded from the result. If a `callback` function
     * is passed, elements at the end of the array are excluded from the result
     * as long as the `callback` returns truthy. The `callback` is bound to
     * `thisArg` and invoked with three arguments; (value, index, array).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|Number|String} [callback|n=1] The function called
     *  per element or the number of elements to exclude. If a property name or
     *  object is passed, it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a slice of `array`.
     * @example
     *
     * _.initial([1, 2, 3]);
     * // => [1, 2]
     *
     * _.initial([1, 2, 3], 2);
     * // => [1]
     *
     * _.initial([1, 2, 3], function(num) {
     *   return num > 1;
     * });
     * // => [1]
     *
     * var food = [
     *   { 'name': 'beet',   'organic': false },
     *   { 'name': 'carrot', 'organic': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.initial(food, 'organic');
     * // => [{ 'name': 'beet',   'organic': false }]
     *
     * var food = [
     *   { 'name': 'banana', 'type': 'fruit' },
     *   { 'name': 'beet',   'type': 'vegetable' },
     *   { 'name': 'carrot', 'type': 'vegetable' }
     * ];
     *
     * // using "_.where" callback shorthand
     * _.initial(food, { 'type': 'vegetable' });
     * // => [{ 'name': 'banana', 'type': 'fruit' }]
     */
    function initial(array, callback, thisArg) {
      if (!array) {
        return [];
      }
      var n = 0,
          length = array.length;

      if (typeof callback != 'number' && callback != null) {
        var index = length;
        callback = lodash.createCallback(callback, thisArg);
        while (index-- && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = (callback == null || thisArg) ? 1 : callback || n;
      }
      return slice(array, 0, nativeMin(nativeMax(0, length - n), length));
    }

    /**
     * Computes the intersection of all the passed-in arrays using strict equality
     * for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} [array1, array2, ...] Arrays to process.
     * @returns {Array} Returns a new array of unique elements that are present
     *  in **all** of the arrays.
     * @example
     *
     * _.intersection([1, 2, 3], [101, 2, 1, 10], [2, 1]);
     * // => [1, 2]
     */
    function intersection(array) {
      var args = arguments,
          argsLength = args.length,
          cache = { '0': {} },
          index = -1,
          length = array ? array.length : 0,
          isLarge = length >= 100,
          result = [],
          seen = result;

      outer:
      while (++index < length) {
        var value = array[index];
        if (isLarge) {
          var key = String(value);
          var inited = hasOwnProperty.call(cache[0], key)
            ? !(seen = cache[0][key])
            : (seen = cache[0][key] = []);
        }
        if (inited || indexOf(seen, value) < 0) {
          if (isLarge) {
            seen.push(value);
          }
          var argsIndex = argsLength;
          while (--argsIndex) {
            if (!(cache[argsIndex] || (cache[argsIndex] = cachedContains(args[argsIndex], 0, 100)))(value)) {
              continue outer;
            }
          }
          result.push(value);
        }
      }
      return result;
    }

    /**
     * Gets the last element of the `array`. If a number `n` is passed, the
     * last `n` elements of the `array` are returned. If a `callback` function
     * is passed, elements at the end of the array are returned as long as the
     * `callback` returns truthy. The `callback` is bound to `thisArg` and
     * invoked with three arguments;(value, index, array).
     *
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|Number|String} [callback|n] The function called
     *  per element or the number of elements to return. If a property name or
     *  object is passed, it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Mixed} Returns the last element(s) of `array`.
     * @example
     *
     * _.last([1, 2, 3]);
     * // => 3
     *
     * _.last([1, 2, 3], 2);
     * // => [2, 3]
     *
     * _.last([1, 2, 3], function(num) {
     *   return num > 1;
     * });
     * // => [2, 3]
     *
     * var food = [
     *   { 'name': 'beet',   'organic': false },
     *   { 'name': 'carrot', 'organic': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.last(food, 'organic');
     * // => [{ 'name': 'carrot', 'organic': true }]
     *
     * var food = [
     *   { 'name': 'banana', 'type': 'fruit' },
     *   { 'name': 'beet',   'type': 'vegetable' },
     *   { 'name': 'carrot', 'type': 'vegetable' }
     * ];
     *
     * // using "_.where" callback shorthand
     * _.last(food, { 'type': 'vegetable' });
     * // => [{ 'name': 'beet', 'type': 'vegetable' }, { 'name': 'carrot', 'type': 'vegetable' }]
     */
    function last(array, callback, thisArg) {
      if (array) {
        var n = 0,
            length = array.length;

        if (typeof callback != 'number' && callback != null) {
          var index = length;
          callback = lodash.createCallback(callback, thisArg);
          while (index-- && callback(array[index], index, array)) {
            n++;
          }
        } else {
          n = callback;
          if (n == null || thisArg) {
            return array[length - 1];
          }
        }
        return slice(array, nativeMax(0, length - n));
      }
    }

    /**
     * Gets the index at which the last occurrence of `value` is found using strict
     * equality for comparisons, i.e. `===`. If `fromIndex` is negative, it is used
     * as the offset from the end of the collection.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {Mixed} value The value to search for.
     * @param {Number} [fromIndex=array.length-1] The index to search from.
     * @returns {Number} Returns the index of the matched value or `-1`.
     * @example
     *
     * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
     * // => 4
     *
     * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2, 3);
     * // => 1
     */
    function lastIndexOf(array, value, fromIndex) {
      var index = array ? array.length : 0;
      if (typeof fromIndex == 'number') {
        index = (fromIndex < 0 ? nativeMax(0, index + fromIndex) : nativeMin(fromIndex, index - 1)) + 1;
      }
      while (index--) {
        if (array[index] === value) {
          return index;
        }
      }
      return -1;
    }

    /**
     * Creates an array of numbers (positive and/or negative) progressing from
     * `start` up to but not including `end`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Number} [start=0] The start of the range.
     * @param {Number} end The end of the range.
     * @param {Number} [step=1] The value to increment or decrement by.
     * @returns {Array} Returns a new range array.
     * @example
     *
     * _.range(10);
     * // => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
     *
     * _.range(1, 11);
     * // => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
     *
     * _.range(0, 30, 5);
     * // => [0, 5, 10, 15, 20, 25]
     *
     * _.range(0, -10, -1);
     * // => [0, -1, -2, -3, -4, -5, -6, -7, -8, -9]
     *
     * _.range(0);
     * // => []
     */
    function range(start, end, step) {
      start = +start || 0;
      step = +step || 1;

      if (end == null) {
        end = start;
        start = 0;
      }
      // use `Array(length)` so V8 will avoid the slower "dictionary" mode
      // http://youtu.be/XAqIpGU8ZZk#t=17m25s
      var index = -1,
          length = nativeMax(0, ceil((end - start) / step)),
          result = Array(length);

      while (++index < length) {
        result[index] = start;
        start += step;
      }
      return result;
    }

    /**
     * The opposite of `_.initial`, this method gets all but the first value of
     * `array`. If a number `n` is passed, the first `n` values are excluded from
     * the result. If a `callback` function is passed, elements at the beginning
     * of the array are excluded from the result as long as the `callback` returns
     * truthy. The `callback` is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias drop, tail
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|Number|String} [callback|n=1] The function called
     *  per element or the number of elements to exclude. If a property name or
     *  object is passed, it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a slice of `array`.
     * @example
     *
     * _.rest([1, 2, 3]);
     * // => [2, 3]
     *
     * _.rest([1, 2, 3], 2);
     * // => [3]
     *
     * _.rest([1, 2, 3], function(num) {
     *   return num < 3;
     * });
     * // => [3]
     *
     * var food = [
     *   { 'name': 'banana', 'organic': true },
     *   { 'name': 'beet',   'organic': false },
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.rest(food, 'organic');
     * // => [{ 'name': 'beet', 'organic': false }]
     *
     * var food = [
     *   { 'name': 'apple',  'type': 'fruit' },
     *   { 'name': 'banana', 'type': 'fruit' },
     *   { 'name': 'beet',   'type': 'vegetable' }
     * ];
     *
     * // using "_.where" callback shorthand
     * _.rest(food, { 'type': 'fruit' });
     * // => [{ 'name': 'beet', 'type': 'vegetable' }]
     */
    function rest(array, callback, thisArg) {
      if (typeof callback != 'number' && callback != null) {
        var n = 0,
            index = -1,
            length = array ? array.length : 0;

        callback = lodash.createCallback(callback, thisArg);
        while (++index < length && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = (callback == null || thisArg) ? 1 : nativeMax(0, callback);
      }
      return slice(array, n);
    }

    /**
     * Uses a binary search to determine the smallest index at which the `value`
     * should be inserted into `array` in order to maintain the sort order of the
     * sorted `array`. If `callback` is passed, it will be executed for `value` and
     * each element in `array` to compute their sort ranking. The `callback` is
     * bound to `thisArg` and invoked with one argument; (value).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to iterate over.
     * @param {Mixed} value The value to evaluate.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Number} Returns the index at which the value should be inserted
     *  into `array`.
     * @example
     *
     * _.sortedIndex([20, 30, 50], 40);
     * // => 2
     *
     * // using "_.pluck" callback shorthand
     * _.sortedIndex([{ 'x': 20 }, { 'x': 30 }, { 'x': 50 }], { 'x': 40 }, 'x');
     * // => 2
     *
     * var dict = {
     *   'wordToNumber': { 'twenty': 20, 'thirty': 30, 'fourty': 40, 'fifty': 50 }
     * };
     *
     * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
     *   return dict.wordToNumber[word];
     * });
     * // => 2
     *
     * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
     *   return this.wordToNumber[word];
     * }, dict);
     * // => 2
     */
    function sortedIndex(array, value, callback, thisArg) {
      var low = 0,
          high = array ? array.length : low;

      // explicitly reference `identity` for better inlining in Firefox
      callback = callback ? lodash.createCallback(callback, thisArg, 1) : identity;
      value = callback(value);

      while (low < high) {
        var mid = (low + high) >>> 1;
        (callback(array[mid]) < value)
          ? low = mid + 1
          : high = mid;
      }
      return low;
    }

    /**
     * Computes the union of the passed-in arrays using strict equality for
     * comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} [array1, array2, ...] Arrays to process.
     * @returns {Array} Returns a new array of unique values, in order, that are
     *  present in one or more of the arrays.
     * @example
     *
     * _.union([1, 2, 3], [101, 2, 1, 10], [2, 1]);
     * // => [1, 2, 3, 101, 10]
     */
    function union() {
      return uniq(concat.apply(arrayRef, arguments));
    }

    /**
     * Creates a duplicate-value-free version of the `array` using strict equality
     * for comparisons, i.e. `===`. If the `array` is already sorted, passing `true`
     * for `isSorted` will run a faster algorithm. If `callback` is passed, each
     * element of `array` is passed through a callback` before uniqueness is computed.
     * The `callback` is bound to `thisArg` and invoked with three arguments; (value, index, array).
     *
     * If a property name is passed for `callback`, the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is passed for `callback`, the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias unique
     * @category Arrays
     * @param {Array} array The array to process.
     * @param {Boolean} [isSorted=false] A flag to indicate that the `array` is already sorted.
     * @param {Function|Object|String} [callback=identity] The function called per
     *  iteration. If a property name or object is passed, it will be used to create
     *  a "_.pluck" or "_.where" style callback, respectively.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a duplicate-value-free array.
     * @example
     *
     * _.uniq([1, 2, 1, 3, 1]);
     * // => [1, 2, 3]
     *
     * _.uniq([1, 1, 2, 2, 3], true);
     * // => [1, 2, 3]
     *
     * _.uniq([1, 2, 1.5, 3, 2.5], function(num) { return Math.floor(num); });
     * // => [1, 2, 3]
     *
     * _.uniq([1, 2, 1.5, 3, 2.5], function(num) { return this.floor(num); }, Math);
     * // => [1, 2, 3]
     *
     * // using "_.pluck" callback shorthand
     * _.uniq([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
     * // => [{ 'x': 1 }, { 'x': 2 }]
     */
    function uniq(array, isSorted, callback, thisArg) {
      var index = -1,
          length = array ? array.length : 0,
          result = [],
          seen = result;

      // juggle arguments
      if (typeof isSorted != 'boolean' && isSorted != null) {
        thisArg = callback;
        callback = isSorted;
        isSorted = false;
      }
      // init value cache for large arrays
      var isLarge = !isSorted && length >= 75;
      if (isLarge) {
        var cache = {};
      }
      if (callback != null) {
        seen = [];
        callback = lodash.createCallback(callback, thisArg);
      }
      while (++index < length) {
        var value = array[index],
            computed = callback ? callback(value, index, array) : value;

        if (isLarge) {
          var key = String(computed);
          var inited = hasOwnProperty.call(cache, key)
            ? !(seen = cache[key])
            : (seen = cache[key] = []);
        }
        if (isSorted
              ? !index || seen[seen.length - 1] !== computed
              : inited || indexOf(seen, computed) < 0
            ) {
          if (callback || isLarge) {
            seen.push(computed);
          }
          result.push(value);
        }
      }
      return result;
    }

    /**
     * Creates an array with all occurrences of the passed values removed using
     * strict equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to filter.
     * @param {Mixed} [value1, value2, ...] Values to remove.
     * @returns {Array} Returns a new filtered array.
     * @example
     *
     * _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
     * // => [2, 3, 4]
     */
    function without(array) {
      var index = -1,
          length = array ? array.length : 0,
          contains = cachedContains(arguments, 1, 30),
          result = [];

      while (++index < length) {
        var value = array[index];
        if (!contains(value)) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * Groups the elements of each array at their corresponding indexes. Useful for
     * separate data sources that are coordinated through matching array indexes.
     * For a matrix of nested arrays, `_.zip.apply(...)` can transpose the matrix
     * in a similar fashion.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} [array1, array2, ...] Arrays to process.
     * @returns {Array} Returns a new array of grouped elements.
     * @example
     *
     * _.zip(['moe', 'larry'], [30, 40], [true, false]);
     * // => [['moe', 30, true], ['larry', 40, false]]
     */
    function zip(array) {
      var index = -1,
          length = array ? max(pluck(arguments, 'length')) : 0,
          result = Array(length);

      while (++index < length) {
        result[index] = pluck(arguments, index);
      }
      return result;
    }

    /**
     * Creates an object composed from arrays of `keys` and `values`. Pass either
     * a single two dimensional array, i.e. `[[key1, value1], [key2, value2]]`, or
     * two arrays, one of `keys` and one of corresponding `values`.
     *
     * @static
     * @memberOf _
     * @alias object
     * @category Arrays
     * @param {Array} keys The array of keys.
     * @param {Array} [values=[]] The array of values.
     * @returns {Object} Returns an object composed of the given keys and
     *  corresponding values.
     * @example
     *
     * _.zipObject(['moe', 'larry'], [30, 40]);
     * // => { 'moe': 30, 'larry': 40 }
     */
    function zipObject(keys, values) {
      var index = -1,
          length = keys ? keys.length : 0,
          result = {};

      while (++index < length) {
        var key = keys[index];
        if (values) {
          result[key] = values[index];
        } else {
          result[key[0]] = key[1];
        }
      }
      return result;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * If `n` is greater than `0`, a function is created that is restricted to
     * executing `func`, with the `this` binding and arguments of the created
     * function, only after it is called `n` times. If `n` is less than `1`,
     * `func` is executed immediately, without a `this` binding or additional
     * arguments, and its result is returned.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Number} n The number of times the function must be called before
     * it is executed.
     * @param {Function} func The function to restrict.
     * @returns {Function} Returns the new restricted function.
     * @example
     *
     * var renderNotes = _.after(notes.length, render);
     * _.forEach(notes, function(note) {
     *   note.asyncSave({ 'success': renderNotes });
     * });
     * // `renderNotes` is run once, after all notes have saved
     */
    function after(n, func) {
      if (n < 1) {
        return func();
      }
      return function() {
        if (--n < 1) {
          return func.apply(this, arguments);
        }
      };
    }

    /**
     * Creates a function that, when called, invokes `func` with the `this`
     * binding of `thisArg` and prepends any additional `bind` arguments to those
     * passed to the bound function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to bind.
     * @param {Mixed} [thisArg] The `this` binding of `func`.
     * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
     * @returns {Function} Returns the new bound function.
     * @example
     *
     * var func = function(greeting) {
     *   return greeting + ' ' + this.name;
     * };
     *
     * func = _.bind(func, { 'name': 'moe' }, 'hi');
     * func();
     * // => 'hi moe'
     */
    function bind(func, thisArg) {
      // use `Function#bind` if it exists and is fast
      // (in V8 `Function#bind` is slower except when partially applied)
      return support.fastBind || (nativeBind && arguments.length > 2)
        ? nativeBind.call.apply(nativeBind, arguments)
        : createBound(func, thisArg, slice(arguments, 2));
    }

    /**
     * Binds methods on `object` to `object`, overwriting the existing method.
     * Method names may be specified as individual arguments or as arrays of method
     * names. If no method names are provided, all the function properties of `object`
     * will be bound.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Object} object The object to bind and assign the bound methods to.
     * @param {String} [methodName1, methodName2, ...] Method names on the object to bind.
     * @returns {Object} Returns `object`.
     * @example
     *
     * var view = {
     *  'label': 'docs',
     *  'onClick': function() { alert('clicked ' + this.label); }
     * };
     *
     * _.bindAll(view);
     * jQuery('#docs').on('click', view.onClick);
     * // => alerts 'clicked docs', when the button is clicked
     */
    function bindAll(object) {
      var funcs = concat.apply(arrayRef, arguments),
          index = funcs.length > 1 ? 0 : (funcs = functions(object), -1),
          length = funcs.length;

      while (++index < length) {
        var key = funcs[index];
        object[key] = bind(object[key], object);
      }
      return object;
    }

    /**
     * Creates a function that, when called, invokes the method at `object[key]`
     * and prepends any additional `bindKey` arguments to those passed to the bound
     * function. This method differs from `_.bind` by allowing bound functions to
     * reference methods that will be redefined or don't yet exist.
     * See http://michaux.ca/articles/lazy-function-definition-pattern.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Object} object The object the method belongs to.
     * @param {String} key The key of the method.
     * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
     * @returns {Function} Returns the new bound function.
     * @example
     *
     * var object = {
     *   'name': 'moe',
     *   'greet': function(greeting) {
     *     return greeting + ' ' + this.name;
     *   }
     * };
     *
     * var func = _.bindKey(object, 'greet', 'hi');
     * func();
     * // => 'hi moe'
     *
     * object.greet = function(greeting) {
     *   return greeting + ', ' + this.name + '!';
     * };
     *
     * func();
     * // => 'hi, moe!'
     */
    function bindKey(object, key) {
      return createBound(object, key, slice(arguments, 2), indicatorObject);
    }

    /**
     * Creates a function that is the composition of the passed functions,
     * where each function consumes the return value of the function that follows.
     * For example, composing the functions `f()`, `g()`, and `h()` produces `f(g(h()))`.
     * Each function is executed with the `this` binding of the composed function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} [func1, func2, ...] Functions to compose.
     * @returns {Function} Returns the new composed function.
     * @example
     *
     * var greet = function(name) { return 'hi ' + name; };
     * var exclaim = function(statement) { return statement + '!'; };
     * var welcome = _.compose(exclaim, greet);
     * welcome('moe');
     * // => 'hi moe!'
     */
    function compose() {
      var funcs = arguments;
      return function() {
        var args = arguments,
            length = funcs.length;

        while (length--) {
          args = [funcs[length].apply(this, args)];
        }
        return args[0];
      };
    }

    /**
     * Produces a callback bound to an optional `thisArg`. If `func` is a property
     * name, the created callback will return the property value for a given element.
     * If `func` is an object, the created callback will return `true` for elements
     * that contain the equivalent object properties, otherwise it will return `false`.
     *
     * Note: All Lo-Dash methods, that accept a `callback` argument, use `_.createCallback`.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Mixed} [func=identity] The value to convert to a callback.
     * @param {Mixed} [thisArg] The `this` binding of the created callback.
     * @param {Number} [argCount=3] The number of arguments the callback accepts.
     * @returns {Function} Returns a callback function.
     * @example
     *
     * var stooges = [
     *   { 'name': 'moe', 'age': 40 },
     *   { 'name': 'larry', 'age': 50 }
     * ];
     *
     * // wrap to create custom callback shorthands
     * _.createCallback = _.wrap(_.createCallback, function(func, callback, thisArg) {
     *   var match = /^(.+?)__([gl]t)(.+)$/.exec(callback);
     *   return !match ? func(callback, thisArg) : function(object) {
     *     return match[2] == 'gt' ? object[match[1]] > match[3] : object[match[1]] < match[3];
     *   };
     * });
     *
     * _.filter(stooges, 'age__gt45');
     * // => [{ 'name': 'larry', 'age': 50 }]
     *
     * // create mixins with support for "_.pluck" and "_.where" callback shorthands
     * _.mixin({
     *   'toLookup': function(collection, callback, thisArg) {
     *     callback = _.createCallback(callback, thisArg);
     *     return _.reduce(collection, function(result, value, index, collection) {
     *       return (result[callback(value, index, collection)] = value, result);
     *     }, {});
     *   }
     * });
     *
     * _.toLookup(stooges, 'name');
     * // => { 'moe': { 'name': 'moe', 'age': 40 }, 'larry': { 'name': 'larry', 'age': 50 } }
     */
    function createCallback(func, thisArg, argCount) {
      if (func == null) {
        return identity;
      }
      var type = typeof func;
      if (type != 'function') {
        if (type != 'object') {
          return function(object) {
            return object[func];
          };
        }
        var props = keys(func);
        return function(object) {
          var length = props.length,
              result = false;
          while (length--) {
            if (!(result = isEqual(object[props[length]], func[props[length]], indicatorObject))) {
              break;
            }
          }
          return result;
        };
      }
      if (typeof thisArg != 'undefined') {
        if (argCount === 1) {
          return function(value) {
            return func.call(thisArg, value);
          };
        }
        if (argCount === 2) {
          return function(a, b) {
            return func.call(thisArg, a, b);
          };
        }
        if (argCount === 4) {
          return function(accumulator, value, index, collection) {
            return func.call(thisArg, accumulator, value, index, collection);
          };
        }
        return function(value, index, collection) {
          return func.call(thisArg, value, index, collection);
        };
      }
      return func;
    }

    /**
     * Creates a function that will delay the execution of `func` until after
     * `wait` milliseconds have elapsed since the last time it was invoked. Pass
     * `true` for `immediate` to cause debounce to invoke `func` on the leading,
     * instead of the trailing, edge of the `wait` timeout. Subsequent calls to
     * the debounced function will return the result of the last `func` call.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to debounce.
     * @param {Number} wait The number of milliseconds to delay.
     * @param {Boolean} immediate A flag to indicate execution is on the leading
     *  edge of the timeout.
     * @returns {Function} Returns the new debounced function.
     * @example
     *
     * var lazyLayout = _.debounce(calculateLayout, 300);
     * jQuery(window).on('resize', lazyLayout);
     */
    function debounce(func, wait, immediate) {
      var args,
          result,
          thisArg,
          timeoutId;

      function delayed() {
        timeoutId = null;
        if (!immediate) {
          result = func.apply(thisArg, args);
        }
      }
      return function() {
        var isImmediate = immediate && !timeoutId;
        args = arguments;
        thisArg = this;

        clearTimeout(timeoutId);
        timeoutId = setTimeout(delayed, wait);

        if (isImmediate) {
          result = func.apply(thisArg, args);
        }
        return result;
      };
    }

    /**
     * Defers executing the `func` function until the current call stack has cleared.
     * Additional arguments will be passed to `func` when it is invoked.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to defer.
     * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the function with.
     * @returns {Number} Returns the timer id.
     * @example
     *
     * _.defer(function() { alert('deferred'); });
     * // returns from the function before `alert` is called
     */
    function defer(func) {
      var args = slice(arguments, 1);
      return setTimeout(function() { func.apply(undefined, args); }, 1);
    }
    // use `setImmediate` if it's available in Node.js
    if (isV8 && freeModule && typeof setImmediate == 'function') {
      defer = bind(setImmediate, context);
    }

    /**
     * Executes the `func` function after `wait` milliseconds. Additional arguments
     * will be passed to `func` when it is invoked.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to delay.
     * @param {Number} wait The number of milliseconds to delay execution.
     * @param {Mixed} [arg1, arg2, ...] Arguments to invoke the function with.
     * @returns {Number} Returns the timer id.
     * @example
     *
     * var log = _.bind(console.log, console);
     * _.delay(log, 1000, 'logged later');
     * // => 'logged later' (Appears after one second.)
     */
    function delay(func, wait) {
      var args = slice(arguments, 2);
      return setTimeout(function() { func.apply(undefined, args); }, wait);
    }

    /**
     * Creates a function that memoizes the result of `func`. If `resolver` is
     * passed, it will be used to determine the cache key for storing the result
     * based on the arguments passed to the memoized function. By default, the first
     * argument passed to the memoized function is used as the cache key. The `func`
     * is executed with the `this` binding of the memoized function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to have its output memoized.
     * @param {Function} [resolver] A function used to resolve the cache key.
     * @returns {Function} Returns the new memoizing function.
     * @example
     *
     * var fibonacci = _.memoize(function(n) {
     *   return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2);
     * });
     */
    function memoize(func, resolver) {
      var cache = {};
      return function() {
        var key = String(resolver ? resolver.apply(this, arguments) : arguments[0]);
        return hasOwnProperty.call(cache, key)
          ? cache[key]
          : (cache[key] = func.apply(this, arguments));
      };
    }

    /**
     * Creates a function that is restricted to execute `func` once. Repeat calls to
     * the function will return the value of the first call. The `func` is executed
     * with the `this` binding of the created function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to restrict.
     * @returns {Function} Returns the new restricted function.
     * @example
     *
     * var initialize = _.once(createApplication);
     * initialize();
     * initialize();
     * // `initialize` executes `createApplication` once
     */
    function once(func) {
      var ran,
          result;

      return function() {
        if (ran) {
          return result;
        }
        ran = true;
        result = func.apply(this, arguments);

        // clear the `func` variable so the function may be garbage collected
        func = null;
        return result;
      };
    }

    /**
     * Creates a function that, when called, invokes `func` with any additional
     * `partial` arguments prepended to those passed to the new function. This
     * method is similar to `_.bind`, except it does **not** alter the `this` binding.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to partially apply arguments to.
     * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
     * @returns {Function} Returns the new partially applied function.
     * @example
     *
     * var greet = function(greeting, name) { return greeting + ' ' + name; };
     * var hi = _.partial(greet, 'hi');
     * hi('moe');
     * // => 'hi moe'
     */
    function partial(func) {
      return createBound(func, slice(arguments, 1));
    }

    /**
     * This method is similar to `_.partial`, except that `partial` arguments are
     * appended to those passed to the new function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to partially apply arguments to.
     * @param {Mixed} [arg1, arg2, ...] Arguments to be partially applied.
     * @returns {Function} Returns the new partially applied function.
     * @example
     *
     * var defaultsDeep = _.partialRight(_.merge, _.defaults);
     *
     * var options = {
     *   'variable': 'data',
     *   'imports': { 'jq': $ }
     * };
     *
     * defaultsDeep(options, _.templateSettings);
     *
     * options.variable
     * // => 'data'
     *
     * options.imports
     * // => { '_': _, 'jq': $ }
     */
    function partialRight(func) {
      return createBound(func, slice(arguments, 1), null, indicatorObject);
    }

    /**
     * Creates a function that, when executed, will only call the `func`
     * function at most once per every `wait` milliseconds. If the throttled
     * function is invoked more than once during the `wait` timeout, `func` will
     * also be called on the trailing edge of the timeout. Subsequent calls to the
     * throttled function will return the result of the last `func` call.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to throttle.
     * @param {Number} wait The number of milliseconds to throttle executions to.
     * @returns {Function} Returns the new throttled function.
     * @example
     *
     * var throttled = _.throttle(updatePosition, 100);
     * jQuery(window).on('scroll', throttled);
     */
    function throttle(func, wait) {
      var args,
          result,
          thisArg,
          timeoutId,
          lastCalled = 0;

      function trailingCall() {
        lastCalled = new Date;
        timeoutId = null;
        result = func.apply(thisArg, args);
      }
      return function() {
        var now = new Date,
            remaining = wait - (now - lastCalled);

        args = arguments;
        thisArg = this;

        if (remaining <= 0) {
          clearTimeout(timeoutId);
          timeoutId = null;
          lastCalled = now;
          result = func.apply(thisArg, args);
        }
        else if (!timeoutId) {
          timeoutId = setTimeout(trailingCall, remaining);
        }
        return result;
      };
    }

    /**
     * Creates a function that passes `value` to the `wrapper` function as its
     * first argument. Additional arguments passed to the function are appended
     * to those passed to the `wrapper` function. The `wrapper` is executed with
     * the `this` binding of the created function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Mixed} value The value to wrap.
     * @param {Function} wrapper The wrapper function.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var hello = function(name) { return 'hello ' + name; };
     * hello = _.wrap(hello, function(func) {
     *   return 'before, ' + func('moe') + ', after';
     * });
     * hello();
     * // => 'before, hello moe, after'
     */
    function wrap(value, wrapper) {
      return function() {
        var args = [value];
        push.apply(args, arguments);
        return wrapper.apply(this, args);
      };
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Converts the characters `&`, `<`, `>`, `"`, and `'` in `string` to their
     * corresponding HTML entities.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {String} string The string to escape.
     * @returns {String} Returns the escaped string.
     * @example
     *
     * _.escape('Moe, Larry & Curly');
     * // => 'Moe, Larry &amp; Curly'
     */
    function escape(string) {
      return string == null ? '' : String(string).replace(reUnescapedHtml, escapeHtmlChar);
    }

    /**
     * This function returns the first argument passed to it.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Mixed} value Any value.
     * @returns {Mixed} Returns `value`.
     * @example
     *
     * var moe = { 'name': 'moe' };
     * moe === _.identity(moe);
     * // => true
     */
    function identity(value) {
      return value;
    }

    /**
     * Adds functions properties of `object` to the `lodash` function and chainable
     * wrapper.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Object} object The object of function properties to add to `lodash`.
     * @example
     *
     * _.mixin({
     *   'capitalize': function(string) {
     *     return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
     *   }
     * });
     *
     * _.capitalize('moe');
     * // => 'Moe'
     *
     * _('moe').capitalize();
     * // => 'Moe'
     */
    function mixin(object) {
      forEach(functions(object), function(methodName) {
        var func = lodash[methodName] = object[methodName];

        lodash.prototype[methodName] = function() {
          var value = this.__wrapped__,
              args = [value];

          push.apply(args, arguments);
          var result = func.apply(lodash, args);
          return (value && typeof value == 'object' && value == result)
            ? this
            : new lodashWrapper(result);
        };
      });
    }

    /**
     * Reverts the '_' variable to its previous value and returns a reference to
     * the `lodash` function.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @returns {Function} Returns the `lodash` function.
     * @example
     *
     * var lodash = _.noConflict();
     */
    function noConflict() {
      context._ = oldDash;
      return this;
    }

    /**
     * Converts the given `value` into an integer of the specified `radix`.
     *
     * Note: This method avoids differences in native ES3 and ES5 `parseInt`
     * implementations. See http://es5.github.com/#E.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Mixed} value The value to parse.
     * @returns {Number} Returns the new integer value.
     * @example
     *
     * _.parseInt('08');
     * // => 8
     */
    var parseInt = nativeParseInt('08') == 8 ? nativeParseInt : function(value, radix) {
      // Firefox and Opera still follow the ES3 specified implementation of `parseInt`
      return nativeParseInt(isString(value) ? value.replace(reLeadingZeros, '') : value, radix || 0);
    };

    /**
     * Produces a random number between `min` and `max` (inclusive). If only one
     * argument is passed, a number between `0` and the given number will be returned.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Number} [min=0] The minimum possible value.
     * @param {Number} [max=1] The maximum possible value.
     * @returns {Number} Returns a random number.
     * @example
     *
     * _.random(0, 5);
     * // => a number between 0 and 5
     *
     * _.random(5);
     * // => also a number between 0 and 5
     */
    function random(min, max) {
      if (min == null && max == null) {
        max = 1;
      }
      min = +min || 0;
      if (max == null) {
        max = min;
        min = 0;
      }
      return min + floor(nativeRandom() * ((+max || 0) - min + 1));
    }

    /**
     * Resolves the value of `property` on `object`. If `property` is a function,
     * it will be invoked with the `this` binding of `object` and its result returned,
     * else the property value is returned. If `object` is falsey, then `undefined`
     * is returned.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Object} object The object to inspect.
     * @param {String} property The property to get the value of.
     * @returns {Mixed} Returns the resolved value.
     * @example
     *
     * var object = {
     *   'cheese': 'crumpets',
     *   'stuff': function() {
     *     return 'nonsense';
     *   }
     * };
     *
     * _.result(object, 'cheese');
     * // => 'crumpets'
     *
     * _.result(object, 'stuff');
     * // => 'nonsense'
     */
    function result(object, property) {
      var value = object ? object[property] : undefined;
      return isFunction(value) ? object[property]() : value;
    }

    /**
     * A micro-templating method that handles arbitrary delimiters, preserves
     * whitespace, and correctly escapes quotes within interpolated code.
     *
     * Note: In the development build, `_.template` utilizes sourceURLs for easier
     * debugging. See http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
     *
     * Note: Lo-Dash may be used in Chrome extensions by either creating a `lodash csp`
     * build and using precompiled templates, or loading Lo-Dash in a sandbox.
     *
     * For more information on precompiling templates see:
     * http://lodash.com/#custom-builds
     *
     * For more information on Chrome extension sandboxes see:
     * http://developer.chrome.com/stable/extensions/sandboxingEval.html
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {String} text The template text.
     * @param {Obect} data The data object used to populate the text.
     * @param {Object} options The options object.
     *  escape - The "escape" delimiter regexp.
     *  evaluate - The "evaluate" delimiter regexp.
     *  interpolate - The "interpolate" delimiter regexp.
     *  sourceURL - The sourceURL of the template's compiled source.
     *  variable - The data object variable name.
     * @returns {Function|String} Returns a compiled function when no `data` object
     *  is given, else it returns the interpolated text.
     * @example
     *
     * // using a compiled template
     * var compiled = _.template('hello <%= name %>');
     * compiled({ 'name': 'moe' });
     * // => 'hello moe'
     *
     * var list = '<% _.forEach(people, function(name) { %><li><%= name %></li><% }); %>';
     * _.template(list, { 'people': ['moe', 'larry'] });
     * // => '<li>moe</li><li>larry</li>'
     *
     * // using the "escape" delimiter to escape HTML in data property values
     * _.template('<b><%- value %></b>', { 'value': '<script>' });
     * // => '<b>&lt;script&gt;</b>'
     *
     * // using the ES6 delimiter as an alternative to the default "interpolate" delimiter
     * _.template('hello ${ name }', { 'name': 'curly' });
     * // => 'hello curly'
     *
     * // using the internal `print` function in "evaluate" delimiters
     * _.template('<% print("hello " + epithet); %>!', { 'epithet': 'stooge' });
     * // => 'hello stooge!'
     *
     * // using custom template delimiters
     * _.templateSettings = {
     *   'interpolate': /{{([\s\S]+?)}}/g
     * };
     *
     * _.template('hello {{ name }}!', { 'name': 'mustache' });
     * // => 'hello mustache!'
     *
     * // using the `sourceURL` option to specify a custom sourceURL for the template
     * var compiled = _.template('hello <%= name %>', null, { 'sourceURL': '/basic/greeting.jst' });
     * compiled(data);
     * // => find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector
     *
     * // using the `variable` option to ensure a with-statement isn't used in the compiled template
     * var compiled = _.template('hi <%= data.name %>!', null, { 'variable': 'data' });
     * compiled.source;
     * // => function(data) {
     *   var __t, __p = '', __e = _.escape;
     *   __p += 'hi ' + ((__t = ( data.name )) == null ? '' : __t) + '!';
     *   return __p;
     * }
     *
     * // using the `source` property to inline compiled templates for meaningful
     * // line numbers in error messages and a stack trace
     * fs.writeFileSync(path.join(cwd, 'jst.js'), '\
     *   var JST = {\
     *     "main": ' + _.template(mainText).source + '\
     *   };\
     * ');
     */
    function template(text, data, options) {
      // based on John Resig's `tmpl` implementation
      // http://ejohn.org/blog/javascript-micro-templating/
      // and Laura Doktorova's doT.js
      // https://github.com/olado/doT
      var settings = lodash.templateSettings;
      text || (text = '');

      // avoid missing dependencies when `iteratorTemplate` is not defined
      options = defaults({}, options, settings);

      var imports = defaults({}, options.imports, settings.imports),
          importsKeys = keys(imports),
          importsValues = values(imports);

      var isEvaluating,
          index = 0,
          interpolate = options.interpolate || reNoMatch,
          source = "__p += '";

      // compile the regexp to match each delimiter
      var reDelimiters = RegExp(
        (options.escape || reNoMatch).source + '|' +
        interpolate.source + '|' +
        (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + '|' +
        (options.evaluate || reNoMatch).source + '|$'
      , 'g');

      text.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
        interpolateValue || (interpolateValue = esTemplateValue);

        // escape characters that cannot be included in string literals
        source += text.slice(index, offset).replace(reUnescapedString, escapeStringChar);

        // replace delimiters with snippets
        if (escapeValue) {
          source += "' +\n__e(" + escapeValue + ") +\n'";
        }
        if (evaluateValue) {
          isEvaluating = true;
          source += "';\n" + evaluateValue + ";\n__p += '";
        }
        if (interpolateValue) {
          source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
        }
        index = offset + match.length;

        // the JS engine embedded in Adobe products requires returning the `match`
        // string in order to produce the correct `offset` value
        return match;
      });

      source += "';\n";

      // if `variable` is not specified, wrap a with-statement around the generated
      // code to add the data object to the top of the scope chain
      var variable = options.variable,
          hasVariable = variable;

      if (!hasVariable) {
        variable = 'obj';
        source = 'with (' + variable + ') {\n' + source + '\n}\n';
      }
      // cleanup code by stripping empty strings
      source = (isEvaluating ? source.replace(reEmptyStringLeading, '') : source)
        .replace(reEmptyStringMiddle, '$1')
        .replace(reEmptyStringTrailing, '$1;');

      // frame code as the function body
      source = 'function(' + variable + ') {\n' +
        (hasVariable ? '' : variable + ' || (' + variable + ' = {});\n') +
        "var __t, __p = '', __e = _.escape" +
        (isEvaluating
          ? ', __j = Array.prototype.join;\n' +
            "function print() { __p += __j.call(arguments, '') }\n"
          : ';\n'
        ) +
        source +
        'return __p\n}';

      // Use a sourceURL for easier debugging and wrap in a multi-line comment to
      // avoid issues with Narwhal, IE conditional compilation, and the JS engine
      // embedded in Adobe products.
      // http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
      var sourceURL = '\n/*\n//@ sourceURL=' + (options.sourceURL || '/lodash/template/source[' + (templateCounter++) + ']') + '\n*/';

      try {
        var result = Function(importsKeys, 'return ' + source + sourceURL).apply(undefined, importsValues);
      } catch(e) {
        e.source = source;
        throw e;
      }
      if (data) {
        return result(data);
      }
      // provide the compiled function's source via its `toString` method, in
      // supported environments, or the `source` property as a convenience for
      // inlining compiled templates during the build process
      result.source = source;
      return result;
    }

    /**
     * Executes the `callback` function `n` times, returning an array of the results
     * of each `callback` execution. The `callback` is bound to `thisArg` and invoked
     * with one argument; (index).
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Number} n The number of times to execute the callback.
     * @param {Function} callback The function called per iteration.
     * @param {Mixed} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of the results of each `callback` execution.
     * @example
     *
     * var diceRolls = _.times(3, _.partial(_.random, 1, 6));
     * // => [3, 6, 4]
     *
     * _.times(3, function(n) { mage.castSpell(n); });
     * // => calls `mage.castSpell(n)` three times, passing `n` of `0`, `1`, and `2` respectively
     *
     * _.times(3, function(n) { this.cast(n); }, mage);
     * // => also calls `mage.castSpell(n)` three times
     */
    function times(n, callback, thisArg) {
      n = (n = +n) > -1 ? n : 0;
      var index = -1,
          result = Array(n);

      callback = lodash.createCallback(callback, thisArg, 1);
      while (++index < n) {
        result[index] = callback(index);
      }
      return result;
    }

    /**
     * The opposite of `_.escape`, this method converts the HTML entities
     * `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `string` to their
     * corresponding characters.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {String} string The string to unescape.
     * @returns {String} Returns the unescaped string.
     * @example
     *
     * _.unescape('Moe, Larry &amp; Curly');
     * // => 'Moe, Larry & Curly'
     */
    function unescape(string) {
      return string == null ? '' : String(string).replace(reEscapedHtml, unescapeHtmlChar);
    }

    /**
     * Generates a unique ID. If `prefix` is passed, the ID will be appended to it.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {String} [prefix] The value to prefix the ID with.
     * @returns {String} Returns the unique ID.
     * @example
     *
     * _.uniqueId('contact_');
     * // => 'contact_104'
     *
     * _.uniqueId();
     * // => '105'
     */
    function uniqueId(prefix) {
      var id = ++idCounter;
      return String(prefix == null ? '' : prefix) + id;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Invokes `interceptor` with the `value` as the first argument, and then
     * returns `value`. The purpose of this method is to "tap into" a method chain,
     * in order to perform operations on intermediate results within the chain.
     *
     * @static
     * @memberOf _
     * @category Chaining
     * @param {Mixed} value The value to pass to `interceptor`.
     * @param {Function} interceptor The function to invoke.
     * @returns {Mixed} Returns `value`.
     * @example
     *
     * _([1, 2, 3, 4])
     *  .filter(function(num) { return num % 2 == 0; })
     *  .tap(alert)
     *  .map(function(num) { return num * num; })
     *  .value();
     * // => // [2, 4] (alerted)
     * // => [4, 16]
     */
    function tap(value, interceptor) {
      interceptor(value);
      return value;
    }

    /**
     * Produces the `toString` result of the wrapped value.
     *
     * @name toString
     * @memberOf _
     * @category Chaining
     * @returns {String} Returns the string result.
     * @example
     *
     * _([1, 2, 3]).toString();
     * // => '1,2,3'
     */
    function wrapperToString() {
      return String(this.__wrapped__);
    }

    /**
     * Extracts the wrapped value.
     *
     * @name valueOf
     * @memberOf _
     * @alias value
     * @category Chaining
     * @returns {Mixed} Returns the wrapped value.
     * @example
     *
     * _([1, 2, 3]).valueOf();
     * // => [1, 2, 3]
     */
    function wrapperValueOf() {
      return this.__wrapped__;
    }

    /*--------------------------------------------------------------------------*/

    // add functions that return wrapped values when chaining
    lodash.after = after;
    lodash.assign = assign;
    lodash.at = at;
    lodash.bind = bind;
    lodash.bindAll = bindAll;
    lodash.bindKey = bindKey;
    lodash.compact = compact;
    lodash.compose = compose;
    lodash.countBy = countBy;
    lodash.createCallback = createCallback;
    lodash.debounce = debounce;
    lodash.defaults = defaults;
    lodash.defer = defer;
    lodash.delay = delay;
    lodash.difference = difference;
    lodash.filter = filter;
    lodash.flatten = flatten;
    lodash.forEach = forEach;
    lodash.forIn = forIn;
    lodash.forOwn = forOwn;
    lodash.functions = functions;
    lodash.groupBy = groupBy;
    lodash.initial = initial;
    lodash.intersection = intersection;
    lodash.invert = invert;
    lodash.invoke = invoke;
    lodash.keys = keys;
    lodash.map = map;
    lodash.max = max;
    lodash.memoize = memoize;
    lodash.merge = merge;
    lodash.min = min;
    lodash.omit = omit;
    lodash.once = once;
    lodash.pairs = pairs;
    lodash.partial = partial;
    lodash.partialRight = partialRight;
    lodash.pick = pick;
    lodash.pluck = pluck;
    lodash.range = range;
    lodash.reject = reject;
    lodash.rest = rest;
    lodash.shuffle = shuffle;
    lodash.sortBy = sortBy;
    lodash.tap = tap;
    lodash.throttle = throttle;
    lodash.times = times;
    lodash.toArray = toArray;
    lodash.union = union;
    lodash.uniq = uniq;
    lodash.values = values;
    lodash.where = where;
    lodash.without = without;
    lodash.wrap = wrap;
    lodash.zip = zip;
    lodash.zipObject = zipObject;

    // add aliases
    lodash.collect = map;
    lodash.drop = rest;
    lodash.each = forEach;
    lodash.extend = assign;
    lodash.methods = functions;
    lodash.object = zipObject;
    lodash.select = filter;
    lodash.tail = rest;
    lodash.unique = uniq;

    // add functions to `lodash.prototype`
    mixin(lodash);

    /*--------------------------------------------------------------------------*/

    // add functions that return unwrapped values when chaining
    lodash.clone = clone;
    lodash.cloneDeep = cloneDeep;
    lodash.contains = contains;
    lodash.escape = escape;
    lodash.every = every;
    lodash.find = find;
    lodash.findIndex = findIndex;
    lodash.findKey = findKey;
    lodash.has = has;
    lodash.identity = identity;
    lodash.indexOf = indexOf;
    lodash.isArguments = isArguments;
    lodash.isArray = isArray;
    lodash.isBoolean = isBoolean;
    lodash.isDate = isDate;
    lodash.isElement = isElement;
    lodash.isEmpty = isEmpty;
    lodash.isEqual = isEqual;
    lodash.isFinite = isFinite;
    lodash.isFunction = isFunction;
    lodash.isNaN = isNaN;
    lodash.isNull = isNull;
    lodash.isNumber = isNumber;
    lodash.isObject = isObject;
    lodash.isPlainObject = isPlainObject;
    lodash.isRegExp = isRegExp;
    lodash.isString = isString;
    lodash.isUndefined = isUndefined;
    lodash.lastIndexOf = lastIndexOf;
    lodash.mixin = mixin;
    lodash.noConflict = noConflict;
    lodash.parseInt = parseInt;
    lodash.random = random;
    lodash.reduce = reduce;
    lodash.reduceRight = reduceRight;
    lodash.result = result;
    lodash.runInContext = runInContext;
    lodash.size = size;
    lodash.some = some;
    lodash.sortedIndex = sortedIndex;
    lodash.template = template;
    lodash.unescape = unescape;
    lodash.uniqueId = uniqueId;

    // add aliases
    lodash.all = every;
    lodash.any = some;
    lodash.detect = find;
    lodash.foldl = reduce;
    lodash.foldr = reduceRight;
    lodash.include = contains;
    lodash.inject = reduce;

    forOwn(lodash, function(func, methodName) {
      if (!lodash.prototype[methodName]) {
        lodash.prototype[methodName] = function() {
          var args = [this.__wrapped__];
          push.apply(args, arguments);
          return func.apply(lodash, args);
        };
      }
    });

    /*--------------------------------------------------------------------------*/

    // add functions capable of returning wrapped and unwrapped values when chaining
    lodash.first = first;
    lodash.last = last;

    // add aliases
    lodash.take = first;
    lodash.head = first;

    forOwn(lodash, function(func, methodName) {
      if (!lodash.prototype[methodName]) {
        lodash.prototype[methodName]= function(callback, thisArg) {
          var result = func(this.__wrapped__, callback, thisArg);
          return callback == null || (thisArg && typeof callback != 'function')
            ? result
            : new lodashWrapper(result);
        };
      }
    });

    /*--------------------------------------------------------------------------*/

    /**
     * The semantic version number.
     *
     * @static
     * @memberOf _
     * @type String
     */
    lodash.VERSION = '1.1.1';

    // add "Chaining" functions to the wrapper
    lodash.prototype.toString = wrapperToString;
    lodash.prototype.value = wrapperValueOf;
    lodash.prototype.valueOf = wrapperValueOf;

    // add `Array` functions that return unwrapped values
    each(['join', 'pop', 'shift'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        return func.apply(this.__wrapped__, arguments);
      };
    });

    // add `Array` functions that return the wrapped value
    each(['push', 'reverse', 'sort', 'unshift'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        func.apply(this.__wrapped__, arguments);
        return this;
      };
    });

    // add `Array` functions that return new wrapped values
    each(['concat', 'slice', 'splice'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        return new lodashWrapper(func.apply(this.__wrapped__, arguments));
      };
    });

    // avoid array-like object bugs with `Array#shift` and `Array#splice`
    // in Firefox < 10 and IE < 9
    if (!support.spliceObjects) {
      each(['pop', 'shift', 'splice'], function(methodName) {
        var func = arrayRef[methodName],
            isSplice = methodName == 'splice';

        lodash.prototype[methodName] = function() {
          var value = this.__wrapped__,
              result = func.apply(value, arguments);

          if (value.length === 0) {
            delete value[0];
          }
          return isSplice ? new lodashWrapper(result) : result;
        };
      });
    }

    return lodash;
  }

  /*--------------------------------------------------------------------------*/

  // expose Lo-Dash
  var _ = runInContext();

  // some AMD build optimizers, like r.js, check for specific condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // Expose Lo-Dash to the global object even when an AMD loader is present in
    // case Lo-Dash was injected by a third-party script and not intended to be
    // loaded as a module. The global assignment can be reverted in the Lo-Dash
    // module via its `noConflict()` method.
    window._ = _;

    // define as an anonymous module so, through path mapping, it can be
    // referenced as the "underscore" module
    define('_',[],function() {
      return _;
    });
  }
  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if (freeExports && !freeExports.nodeType) {
    // in Node.js or RingoJS v0.8.0+
    if (freeModule) {
      (freeModule.exports = _)._ = _;
    }
    // in Narwhal or RingoJS v0.7.0-
    else {
      freeExports._ = _;
    }
  }
  else {
    // in a browser or Rhino
    window._ = _;
  }
}(this));
define('core/base',['require','./mixin/derive','./mixin/notifier','./mixin/dirty','./cache','_'],function(require){

    var deriveMixin = require("./mixin/derive");
    var notifierMixin = require("./mixin/notifier");
    var dirtyMixin = require("./mixin/dirty");
    var Cache = require("./cache");
    var _ = require("_");

    var Base = function(){
        this.cache = new Cache();
    }
    _.extend(Base, deriveMixin);
    _.extend(Base.prototype, notifierMixin);
    _.extend(Base.prototype, dirtyMixin);

    return Base;
});
/**
 * @fileoverview gl-matrix - High performance matrix and vector operations
 * @author Brandon Jones
 * @author Colin MacKenzie IV
 * @version 2.2.0
 */

/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */


(function(_global) {
  

  var shim = {};
  if (typeof(exports) === 'undefined') {
    if(typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
      shim.exports = {};
      define('glmatrix',[],function() {
        return shim.exports;
      });
    } else {
      // gl-matrix lives in a browser, define its namespaces in global
      shim.exports = typeof(window) !== 'undefined' ? window : _global;
    }
  }
  else {
    // gl-matrix lives in commonjs, define its namespaces in exports
    shim.exports = exports;
  }

  (function(exports) {
    /* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */


if(!GLMAT_EPSILON) {
    var GLMAT_EPSILON = 0.000001;
}

if(!GLMAT_ARRAY_TYPE) {
    var GLMAT_ARRAY_TYPE = (typeof Float32Array !== 'undefined') ? Float32Array : Array;
}

if(!GLMAT_RANDOM) {
    var GLMAT_RANDOM = Math.random;
}

/**
 * @class Common utilities
 * @name glMatrix
 */
var glMatrix = {};

/**
 * Sets the type of array used when creating new vectors and matricies
 *
 * @param {Type} type Array type, such as Float32Array or Array
 */
glMatrix.setMatrixArrayType = function(type) {
    GLMAT_ARRAY_TYPE = type;
}

if(typeof(exports) !== 'undefined') {
    exports.glMatrix = glMatrix;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 2 Dimensional Vector
 * @name vec2
 */

var vec2 = {};

/**
 * Creates a new, empty vec2
 *
 * @returns {vec2} a new 2D vector
 */
vec2.create = function() {
    var out = new GLMAT_ARRAY_TYPE(2);
    out[0] = 0;
    out[1] = 0;
    return out;
};

/**
 * Creates a new vec2 initialized with values from an existing vector
 *
 * @param {vec2} a vector to clone
 * @returns {vec2} a new 2D vector
 */
vec2.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(2);
    out[0] = a[0];
    out[1] = a[1];
    return out;
};

/**
 * Creates a new vec2 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @returns {vec2} a new 2D vector
 */
vec2.fromValues = function(x, y) {
    var out = new GLMAT_ARRAY_TYPE(2);
    out[0] = x;
    out[1] = y;
    return out;
};

/**
 * Copy the values from one vec2 to another
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the source vector
 * @returns {vec2} out
 */
vec2.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    return out;
};

/**
 * Set the components of a vec2 to the given values
 *
 * @param {vec2} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @returns {vec2} out
 */
vec2.set = function(out, x, y) {
    out[0] = x;
    out[1] = y;
    return out;
};

/**
 * Adds two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.add = function(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    return out;
};

/**
 * Subtracts vector b from vector a
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.subtract = function(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    return out;
};

/**
 * Alias for {@link vec2.subtract}
 * @function
 */
vec2.sub = vec2.subtract;

/**
 * Multiplies two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.multiply = function(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    return out;
};

/**
 * Alias for {@link vec2.multiply}
 * @function
 */
vec2.mul = vec2.multiply;

/**
 * Divides two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.divide = function(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    return out;
};

/**
 * Alias for {@link vec2.divide}
 * @function
 */
vec2.div = vec2.divide;

/**
 * Returns the minimum of two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.min = function(out, a, b) {
    out[0] = Math.min(a[0], b[0]);
    out[1] = Math.min(a[1], b[1]);
    return out;
};

/**
 * Returns the maximum of two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec2} out
 */
vec2.max = function(out, a, b) {
    out[0] = Math.max(a[0], b[0]);
    out[1] = Math.max(a[1], b[1]);
    return out;
};

/**
 * Scales a vec2 by a scalar number
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec2} out
 */
vec2.scale = function(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    return out;
};

/**
 * Adds two vec2's after scaling the second operand by a scalar value
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec2} out
 */
vec2.scaleAndAdd = function(out, a, b, scale) {
    out[0] = a[0] + (b[0] * scale);
    out[1] = a[1] + (b[1] * scale);
    return out;
};

/**
 * Calculates the euclidian distance between two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} distance between a and b
 */
vec2.distance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1];
    return Math.sqrt(x*x + y*y);
};

/**
 * Alias for {@link vec2.distance}
 * @function
 */
vec2.dist = vec2.distance;

/**
 * Calculates the squared euclidian distance between two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} squared distance between a and b
 */
vec2.squaredDistance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1];
    return x*x + y*y;
};

/**
 * Alias for {@link vec2.squaredDistance}
 * @function
 */
vec2.sqrDist = vec2.squaredDistance;

/**
 * Calculates the length of a vec2
 *
 * @param {vec2} a vector to calculate length of
 * @returns {Number} length of a
 */
vec2.length = function (a) {
    var x = a[0],
        y = a[1];
    return Math.sqrt(x*x + y*y);
};

/**
 * Alias for {@link vec2.length}
 * @function
 */
vec2.len = vec2.length;

/**
 * Calculates the squared length of a vec2
 *
 * @param {vec2} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
vec2.squaredLength = function (a) {
    var x = a[0],
        y = a[1];
    return x*x + y*y;
};

/**
 * Alias for {@link vec2.squaredLength}
 * @function
 */
vec2.sqrLen = vec2.squaredLength;

/**
 * Negates the components of a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a vector to negate
 * @returns {vec2} out
 */
vec2.negate = function(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    return out;
};

/**
 * Normalize a vec2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a vector to normalize
 * @returns {vec2} out
 */
vec2.normalize = function(out, a) {
    var x = a[0],
        y = a[1];
    var len = x*x + y*y;
    if (len > 0) {
        //TODO: evaluate use of glm_invsqrt here?
        len = 1 / Math.sqrt(len);
        out[0] = a[0] * len;
        out[1] = a[1] * len;
    }
    return out;
};

/**
 * Calculates the dot product of two vec2's
 *
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {Number} dot product of a and b
 */
vec2.dot = function (a, b) {
    return a[0] * b[0] + a[1] * b[1];
};

/**
 * Computes the cross product of two vec2's
 * Note that the cross product must by definition produce a 3D vector
 *
 * @param {vec3} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @returns {vec3} out
 */
vec2.cross = function(out, a, b) {
    var z = a[0] * b[1] - a[1] * b[0];
    out[0] = out[1] = 0;
    out[2] = z;
    return out;
};

/**
 * Performs a linear interpolation between two vec2's
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the first operand
 * @param {vec2} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec2} out
 */
vec2.lerp = function (out, a, b, t) {
    var ax = a[0],
        ay = a[1];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    return out;
};

/**
 * Generates a random vector with the given scale
 *
 * @param {vec2} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec2} out
 */
vec2.random = function (out, scale) {
    scale = scale || 1.0;
    var r = GLMAT_RANDOM() * 2.0 * Math.PI;
    out[0] = Math.cos(r) * scale;
    out[1] = Math.sin(r) * scale;
    return out;
};

/**
 * Transforms the vec2 with a mat2
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat2} m matrix to transform with
 * @returns {vec2} out
 */
vec2.transformMat2 = function(out, a, m) {
    var x = a[0],
        y = a[1];
    out[0] = m[0] * x + m[2] * y;
    out[1] = m[1] * x + m[3] * y;
    return out;
};

/**
 * Transforms the vec2 with a mat2d
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat2d} m matrix to transform with
 * @returns {vec2} out
 */
vec2.transformMat2d = function(out, a, m) {
    var x = a[0],
        y = a[1];
    out[0] = m[0] * x + m[2] * y + m[4];
    out[1] = m[1] * x + m[3] * y + m[5];
    return out;
};

/**
 * Transforms the vec2 with a mat3
 * 3rd vector component is implicitly '1'
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat3} m matrix to transform with
 * @returns {vec2} out
 */
vec2.transformMat3 = function(out, a, m) {
    var x = a[0],
        y = a[1];
    out[0] = m[0] * x + m[3] * y + m[6];
    out[1] = m[1] * x + m[4] * y + m[7];
    return out;
};

/**
 * Transforms the vec2 with a mat4
 * 3rd vector component is implicitly '0'
 * 4th vector component is implicitly '1'
 *
 * @param {vec2} out the receiving vector
 * @param {vec2} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec2} out
 */
vec2.transformMat4 = function(out, a, m) {
    var x = a[0], 
        y = a[1];
    out[0] = m[0] * x + m[4] * y + m[12];
    out[1] = m[1] * x + m[5] * y + m[13];
    return out;
};

/**
 * Perform some operation over an array of vec2s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
vec2.forEach = (function() {
    var vec = vec2.create();

    return function(a, stride, offset, count, fn, arg) {
        var i, l;
        if(!stride) {
            stride = 2;
        }

        if(!offset) {
            offset = 0;
        }
        
        if(count) {
            l = Math.min((count * stride) + offset, a.length);
        } else {
            l = a.length;
        }

        for(i = offset; i < l; i += stride) {
            vec[0] = a[i]; vec[1] = a[i+1];
            fn(vec, vec, arg);
            a[i] = vec[0]; a[i+1] = vec[1];
        }
        
        return a;
    };
})();

/**
 * Returns a string representation of a vector
 *
 * @param {vec2} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */
vec2.str = function (a) {
    return 'vec2(' + a[0] + ', ' + a[1] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.vec2 = vec2;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 3 Dimensional Vector
 * @name vec3
 */

var vec3 = {};

/**
 * Creates a new, empty vec3
 *
 * @returns {vec3} a new 3D vector
 */
vec3.create = function() {
    var out = new GLMAT_ARRAY_TYPE(3);
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    return out;
};

/**
 * Creates a new vec3 initialized with values from an existing vector
 *
 * @param {vec3} a vector to clone
 * @returns {vec3} a new 3D vector
 */
vec3.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(3);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    return out;
};

/**
 * Creates a new vec3 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} a new 3D vector
 */
vec3.fromValues = function(x, y, z) {
    var out = new GLMAT_ARRAY_TYPE(3);
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
};

/**
 * Copy the values from one vec3 to another
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the source vector
 * @returns {vec3} out
 */
vec3.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    return out;
};

/**
 * Set the components of a vec3 to the given values
 *
 * @param {vec3} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @returns {vec3} out
 */
vec3.set = function(out, x, y, z) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    return out;
};

/**
 * Adds two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.add = function(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    return out;
};

/**
 * Subtracts vector b from vector a
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.subtract = function(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    return out;
};

/**
 * Alias for {@link vec3.subtract}
 * @function
 */
vec3.sub = vec3.subtract;

/**
 * Multiplies two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.multiply = function(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    out[2] = a[2] * b[2];
    return out;
};

/**
 * Alias for {@link vec3.multiply}
 * @function
 */
vec3.mul = vec3.multiply;

/**
 * Divides two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.divide = function(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    out[2] = a[2] / b[2];
    return out;
};

/**
 * Alias for {@link vec3.divide}
 * @function
 */
vec3.div = vec3.divide;

/**
 * Returns the minimum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.min = function(out, a, b) {
    out[0] = Math.min(a[0], b[0]);
    out[1] = Math.min(a[1], b[1]);
    out[2] = Math.min(a[2], b[2]);
    return out;
};

/**
 * Returns the maximum of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.max = function(out, a, b) {
    out[0] = Math.max(a[0], b[0]);
    out[1] = Math.max(a[1], b[1]);
    out[2] = Math.max(a[2], b[2]);
    return out;
};

/**
 * Scales a vec3 by a scalar number
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec3} out
 */
vec3.scale = function(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    out[2] = a[2] * b;
    return out;
};

/**
 * Adds two vec3's after scaling the second operand by a scalar value
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec3} out
 */
vec3.scaleAndAdd = function(out, a, b, scale) {
    out[0] = a[0] + (b[0] * scale);
    out[1] = a[1] + (b[1] * scale);
    out[2] = a[2] + (b[2] * scale);
    return out;
};

/**
 * Calculates the euclidian distance between two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} distance between a and b
 */
vec3.distance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2];
    return Math.sqrt(x*x + y*y + z*z);
};

/**
 * Alias for {@link vec3.distance}
 * @function
 */
vec3.dist = vec3.distance;

/**
 * Calculates the squared euclidian distance between two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} squared distance between a and b
 */
vec3.squaredDistance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2];
    return x*x + y*y + z*z;
};

/**
 * Alias for {@link vec3.squaredDistance}
 * @function
 */
vec3.sqrDist = vec3.squaredDistance;

/**
 * Calculates the length of a vec3
 *
 * @param {vec3} a vector to calculate length of
 * @returns {Number} length of a
 */
vec3.length = function (a) {
    var x = a[0],
        y = a[1],
        z = a[2];
    return Math.sqrt(x*x + y*y + z*z);
};

/**
 * Alias for {@link vec3.length}
 * @function
 */
vec3.len = vec3.length;

/**
 * Calculates the squared length of a vec3
 *
 * @param {vec3} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
vec3.squaredLength = function (a) {
    var x = a[0],
        y = a[1],
        z = a[2];
    return x*x + y*y + z*z;
};

/**
 * Alias for {@link vec3.squaredLength}
 * @function
 */
vec3.sqrLen = vec3.squaredLength;

/**
 * Negates the components of a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to negate
 * @returns {vec3} out
 */
vec3.negate = function(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    return out;
};

/**
 * Normalize a vec3
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a vector to normalize
 * @returns {vec3} out
 */
vec3.normalize = function(out, a) {
    var x = a[0],
        y = a[1],
        z = a[2];
    var len = x*x + y*y + z*z;
    if (len > 0) {
        //TODO: evaluate use of glm_invsqrt here?
        len = 1 / Math.sqrt(len);
        out[0] = a[0] * len;
        out[1] = a[1] * len;
        out[2] = a[2] * len;
    }
    return out;
};

/**
 * Calculates the dot product of two vec3's
 *
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {Number} dot product of a and b
 */
vec3.dot = function (a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
};

/**
 * Computes the cross product of two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @returns {vec3} out
 */
vec3.cross = function(out, a, b) {
    var ax = a[0], ay = a[1], az = a[2],
        bx = b[0], by = b[1], bz = b[2];

    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
};

/**
 * Performs a linear interpolation between two vec3's
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the first operand
 * @param {vec3} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec3} out
 */
vec3.lerp = function (out, a, b, t) {
    var ax = a[0],
        ay = a[1],
        az = a[2];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    out[2] = az + t * (b[2] - az);
    return out;
};

/**
 * Generates a random vector with the given scale
 *
 * @param {vec3} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec3} out
 */
vec3.random = function (out, scale) {
    scale = scale || 1.0;

    var r = GLMAT_RANDOM() * 2.0 * Math.PI;
    var z = (GLMAT_RANDOM() * 2.0) - 1.0;
    var zScale = Math.sqrt(1.0-z*z) * scale;

    out[0] = Math.cos(r) * zScale;
    out[1] = Math.sin(r) * zScale;
    out[2] = z * scale;
    return out;
};

/**
 * Transforms the vec3 with a mat4.
 * 4th vector component is implicitly '1'
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec3} out
 */
vec3.transformMat4 = function(out, a, m) {
    var x = a[0], y = a[1], z = a[2];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    return out;
};

/**
 * Transforms the vec3 with a mat3.
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {mat4} m the 3x3 matrix to transform with
 * @returns {vec3} out
 */
vec3.transformMat3 = function(out, a, m) {
    var x = a[0], y = a[1], z = a[2];
    out[0] = x * m[0] + y * m[3] + z * m[6];
    out[1] = x * m[1] + y * m[4] + z * m[7];
    out[2] = x * m[2] + y * m[5] + z * m[8];
    return out;
};

/**
 * Transforms the vec3 with a quat
 *
 * @param {vec3} out the receiving vector
 * @param {vec3} a the vector to transform
 * @param {quat} q quaternion to transform with
 * @returns {vec3} out
 */
vec3.transformQuat = function(out, a, q) {
    // benchmarks: http://jsperf.com/quaternion-transform-vec3-implementations

    var x = a[0], y = a[1], z = a[2],
        qx = q[0], qy = q[1], qz = q[2], qw = q[3],

        // calculate quat * vec
        ix = qw * x + qy * z - qz * y,
        iy = qw * y + qz * x - qx * z,
        iz = qw * z + qx * y - qy * x,
        iw = -qx * x - qy * y - qz * z;

    // calculate result * inverse quat
    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return out;
};

/**
 * Perform some operation over an array of vec3s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
vec3.forEach = (function() {
    var vec = vec3.create();

    return function(a, stride, offset, count, fn, arg) {
        var i, l;
        if(!stride) {
            stride = 3;
        }

        if(!offset) {
            offset = 0;
        }
        
        if(count) {
            l = Math.min((count * stride) + offset, a.length);
        } else {
            l = a.length;
        }

        for(i = offset; i < l; i += stride) {
            vec[0] = a[i]; vec[1] = a[i+1]; vec[2] = a[i+2];
            fn(vec, vec, arg);
            a[i] = vec[0]; a[i+1] = vec[1]; a[i+2] = vec[2];
        }
        
        return a;
    };
})();

/**
 * Returns a string representation of a vector
 *
 * @param {vec3} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */
vec3.str = function (a) {
    return 'vec3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.vec3 = vec3;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 4 Dimensional Vector
 * @name vec4
 */

var vec4 = {};

/**
 * Creates a new, empty vec4
 *
 * @returns {vec4} a new 4D vector
 */
vec4.create = function() {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    return out;
};

/**
 * Creates a new vec4 initialized with values from an existing vector
 *
 * @param {vec4} a vector to clone
 * @returns {vec4} a new 4D vector
 */
vec4.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
};

/**
 * Creates a new vec4 initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {vec4} a new 4D vector
 */
vec4.fromValues = function(x, y, z, w) {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = w;
    return out;
};

/**
 * Copy the values from one vec4 to another
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the source vector
 * @returns {vec4} out
 */
vec4.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
};

/**
 * Set the components of a vec4 to the given values
 *
 * @param {vec4} out the receiving vector
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {vec4} out
 */
vec4.set = function(out, x, y, z, w) {
    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = w;
    return out;
};

/**
 * Adds two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.add = function(out, a, b) {
    out[0] = a[0] + b[0];
    out[1] = a[1] + b[1];
    out[2] = a[2] + b[2];
    out[3] = a[3] + b[3];
    return out;
};

/**
 * Subtracts vector b from vector a
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.subtract = function(out, a, b) {
    out[0] = a[0] - b[0];
    out[1] = a[1] - b[1];
    out[2] = a[2] - b[2];
    out[3] = a[3] - b[3];
    return out;
};

/**
 * Alias for {@link vec4.subtract}
 * @function
 */
vec4.sub = vec4.subtract;

/**
 * Multiplies two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.multiply = function(out, a, b) {
    out[0] = a[0] * b[0];
    out[1] = a[1] * b[1];
    out[2] = a[2] * b[2];
    out[3] = a[3] * b[3];
    return out;
};

/**
 * Alias for {@link vec4.multiply}
 * @function
 */
vec4.mul = vec4.multiply;

/**
 * Divides two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.divide = function(out, a, b) {
    out[0] = a[0] / b[0];
    out[1] = a[1] / b[1];
    out[2] = a[2] / b[2];
    out[3] = a[3] / b[3];
    return out;
};

/**
 * Alias for {@link vec4.divide}
 * @function
 */
vec4.div = vec4.divide;

/**
 * Returns the minimum of two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.min = function(out, a, b) {
    out[0] = Math.min(a[0], b[0]);
    out[1] = Math.min(a[1], b[1]);
    out[2] = Math.min(a[2], b[2]);
    out[3] = Math.min(a[3], b[3]);
    return out;
};

/**
 * Returns the maximum of two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {vec4} out
 */
vec4.max = function(out, a, b) {
    out[0] = Math.max(a[0], b[0]);
    out[1] = Math.max(a[1], b[1]);
    out[2] = Math.max(a[2], b[2]);
    out[3] = Math.max(a[3], b[3]);
    return out;
};

/**
 * Scales a vec4 by a scalar number
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {vec4} out
 */
vec4.scale = function(out, a, b) {
    out[0] = a[0] * b;
    out[1] = a[1] * b;
    out[2] = a[2] * b;
    out[3] = a[3] * b;
    return out;
};

/**
 * Adds two vec4's after scaling the second operand by a scalar value
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @param {Number} scale the amount to scale b by before adding
 * @returns {vec4} out
 */
vec4.scaleAndAdd = function(out, a, b, scale) {
    out[0] = a[0] + (b[0] * scale);
    out[1] = a[1] + (b[1] * scale);
    out[2] = a[2] + (b[2] * scale);
    out[3] = a[3] + (b[3] * scale);
    return out;
};

/**
 * Calculates the euclidian distance between two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} distance between a and b
 */
vec4.distance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2],
        w = b[3] - a[3];
    return Math.sqrt(x*x + y*y + z*z + w*w);
};

/**
 * Alias for {@link vec4.distance}
 * @function
 */
vec4.dist = vec4.distance;

/**
 * Calculates the squared euclidian distance between two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} squared distance between a and b
 */
vec4.squaredDistance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1],
        z = b[2] - a[2],
        w = b[3] - a[3];
    return x*x + y*y + z*z + w*w;
};

/**
 * Alias for {@link vec4.squaredDistance}
 * @function
 */
vec4.sqrDist = vec4.squaredDistance;

/**
 * Calculates the length of a vec4
 *
 * @param {vec4} a vector to calculate length of
 * @returns {Number} length of a
 */
vec4.length = function (a) {
    var x = a[0],
        y = a[1],
        z = a[2],
        w = a[3];
    return Math.sqrt(x*x + y*y + z*z + w*w);
};

/**
 * Alias for {@link vec4.length}
 * @function
 */
vec4.len = vec4.length;

/**
 * Calculates the squared length of a vec4
 *
 * @param {vec4} a vector to calculate squared length of
 * @returns {Number} squared length of a
 */
vec4.squaredLength = function (a) {
    var x = a[0],
        y = a[1],
        z = a[2],
        w = a[3];
    return x*x + y*y + z*z + w*w;
};

/**
 * Alias for {@link vec4.squaredLength}
 * @function
 */
vec4.sqrLen = vec4.squaredLength;

/**
 * Negates the components of a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a vector to negate
 * @returns {vec4} out
 */
vec4.negate = function(out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    out[3] = -a[3];
    return out;
};

/**
 * Normalize a vec4
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a vector to normalize
 * @returns {vec4} out
 */
vec4.normalize = function(out, a) {
    var x = a[0],
        y = a[1],
        z = a[2],
        w = a[3];
    var len = x*x + y*y + z*z + w*w;
    if (len > 0) {
        len = 1 / Math.sqrt(len);
        out[0] = a[0] * len;
        out[1] = a[1] * len;
        out[2] = a[2] * len;
        out[3] = a[3] * len;
    }
    return out;
};

/**
 * Calculates the dot product of two vec4's
 *
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @returns {Number} dot product of a and b
 */
vec4.dot = function (a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
};

/**
 * Performs a linear interpolation between two vec4's
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the first operand
 * @param {vec4} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {vec4} out
 */
vec4.lerp = function (out, a, b, t) {
    var ax = a[0],
        ay = a[1],
        az = a[2],
        aw = a[3];
    out[0] = ax + t * (b[0] - ax);
    out[1] = ay + t * (b[1] - ay);
    out[2] = az + t * (b[2] - az);
    out[3] = aw + t * (b[3] - aw);
    return out;
};

/**
 * Generates a random vector with the given scale
 *
 * @param {vec4} out the receiving vector
 * @param {Number} [scale] Length of the resulting vector. If ommitted, a unit vector will be returned
 * @returns {vec4} out
 */
vec4.random = function (out, scale) {
    scale = scale || 1.0;

    //TODO: This is a pretty awful way of doing this. Find something better.
    out[0] = GLMAT_RANDOM();
    out[1] = GLMAT_RANDOM();
    out[2] = GLMAT_RANDOM();
    out[3] = GLMAT_RANDOM();
    vec4.normalize(out, out);
    vec4.scale(out, out, scale);
    return out;
};

/**
 * Transforms the vec4 with a mat4.
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to transform
 * @param {mat4} m matrix to transform with
 * @returns {vec4} out
 */
vec4.transformMat4 = function(out, a, m) {
    var x = a[0], y = a[1], z = a[2], w = a[3];
    out[0] = m[0] * x + m[4] * y + m[8] * z + m[12] * w;
    out[1] = m[1] * x + m[5] * y + m[9] * z + m[13] * w;
    out[2] = m[2] * x + m[6] * y + m[10] * z + m[14] * w;
    out[3] = m[3] * x + m[7] * y + m[11] * z + m[15] * w;
    return out;
};

/**
 * Transforms the vec4 with a quat
 *
 * @param {vec4} out the receiving vector
 * @param {vec4} a the vector to transform
 * @param {quat} q quaternion to transform with
 * @returns {vec4} out
 */
vec4.transformQuat = function(out, a, q) {
    var x = a[0], y = a[1], z = a[2],
        qx = q[0], qy = q[1], qz = q[2], qw = q[3],

        // calculate quat * vec
        ix = qw * x + qy * z - qz * y,
        iy = qw * y + qz * x - qx * z,
        iz = qw * z + qx * y - qy * x,
        iw = -qx * x - qy * y - qz * z;

    // calculate result * inverse quat
    out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return out;
};

/**
 * Perform some operation over an array of vec4s.
 *
 * @param {Array} a the array of vectors to iterate over
 * @param {Number} stride Number of elements between the start of each vec4. If 0 assumes tightly packed
 * @param {Number} offset Number of elements to skip at the beginning of the array
 * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
 * @param {Function} fn Function to call for each vector in the array
 * @param {Object} [arg] additional argument to pass to fn
 * @returns {Array} a
 * @function
 */
vec4.forEach = (function() {
    var vec = vec4.create();

    return function(a, stride, offset, count, fn, arg) {
        var i, l;
        if(!stride) {
            stride = 4;
        }

        if(!offset) {
            offset = 0;
        }
        
        if(count) {
            l = Math.min((count * stride) + offset, a.length);
        } else {
            l = a.length;
        }

        for(i = offset; i < l; i += stride) {
            vec[0] = a[i]; vec[1] = a[i+1]; vec[2] = a[i+2]; vec[3] = a[i+3];
            fn(vec, vec, arg);
            a[i] = vec[0]; a[i+1] = vec[1]; a[i+2] = vec[2]; a[i+3] = vec[3];
        }
        
        return a;
    };
})();

/**
 * Returns a string representation of a vector
 *
 * @param {vec4} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */
vec4.str = function (a) {
    return 'vec4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.vec4 = vec4;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 2x2 Matrix
 * @name mat2
 */

var mat2 = {};

/**
 * Creates a new identity mat2
 *
 * @returns {mat2} a new 2x2 matrix
 */
mat2.create = function() {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
};

/**
 * Creates a new mat2 initialized with values from an existing matrix
 *
 * @param {mat2} a matrix to clone
 * @returns {mat2} a new 2x2 matrix
 */
mat2.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
};

/**
 * Copy the values from one mat2 to another
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */
mat2.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    return out;
};

/**
 * Set a mat2 to the identity matrix
 *
 * @param {mat2} out the receiving matrix
 * @returns {mat2} out
 */
mat2.identity = function(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
};

/**
 * Transpose the values of a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */
mat2.transpose = function(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
        var a1 = a[1];
        out[1] = a[2];
        out[2] = a1;
    } else {
        out[0] = a[0];
        out[1] = a[2];
        out[2] = a[1];
        out[3] = a[3];
    }
    
    return out;
};

/**
 * Inverts a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */
mat2.invert = function(out, a) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],

        // Calculate the determinant
        det = a0 * a3 - a2 * a1;

    if (!det) {
        return null;
    }
    det = 1.0 / det;
    
    out[0] =  a3 * det;
    out[1] = -a1 * det;
    out[2] = -a2 * det;
    out[3] =  a0 * det;

    return out;
};

/**
 * Calculates the adjugate of a mat2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the source matrix
 * @returns {mat2} out
 */
mat2.adjoint = function(out, a) {
    // Caching this value is nessecary if out == a
    var a0 = a[0];
    out[0] =  a[3];
    out[1] = -a[1];
    out[2] = -a[2];
    out[3] =  a0;

    return out;
};

/**
 * Calculates the determinant of a mat2
 *
 * @param {mat2} a the source matrix
 * @returns {Number} determinant of a
 */
mat2.determinant = function (a) {
    return a[0] * a[3] - a[2] * a[1];
};

/**
 * Multiplies two mat2's
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the first operand
 * @param {mat2} b the second operand
 * @returns {mat2} out
 */
mat2.multiply = function (out, a, b) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
    var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = a0 * b0 + a1 * b2;
    out[1] = a0 * b1 + a1 * b3;
    out[2] = a2 * b0 + a3 * b2;
    out[3] = a2 * b1 + a3 * b3;
    return out;
};

/**
 * Alias for {@link mat2.multiply}
 * @function
 */
mat2.mul = mat2.multiply;

/**
 * Rotates a mat2 by the given angle
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat2} out
 */
mat2.rotate = function (out, a, rad) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
        s = Math.sin(rad),
        c = Math.cos(rad);
    out[0] = a0 *  c + a1 * s;
    out[1] = a0 * -s + a1 * c;
    out[2] = a2 *  c + a3 * s;
    out[3] = a2 * -s + a3 * c;
    return out;
};

/**
 * Scales the mat2 by the dimensions in the given vec2
 *
 * @param {mat2} out the receiving matrix
 * @param {mat2} a the matrix to rotate
 * @param {vec2} v the vec2 to scale the matrix by
 * @returns {mat2} out
 **/
mat2.scale = function(out, a, v) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
        v0 = v[0], v1 = v[1];
    out[0] = a0 * v0;
    out[1] = a1 * v1;
    out[2] = a2 * v0;
    out[3] = a3 * v1;
    return out;
};

/**
 * Returns a string representation of a mat2
 *
 * @param {mat2} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
mat2.str = function (a) {
    return 'mat2(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.mat2 = mat2;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 2x3 Matrix
 * @name mat2d
 * 
 * @description 
 * A mat2d contains six elements defined as:
 * <pre>
 * [a, b,
 *  c, d,
 *  tx,ty]
 * </pre>
 * This is a short form for the 3x3 matrix:
 * <pre>
 * [a, b, 0
 *  c, d, 0
 *  tx,ty,1]
 * </pre>
 * The last column is ignored so the array is shorter and operations are faster.
 */

var mat2d = {};

/**
 * Creates a new identity mat2d
 *
 * @returns {mat2d} a new 2x3 matrix
 */
mat2d.create = function() {
    var out = new GLMAT_ARRAY_TYPE(6);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    out[4] = 0;
    out[5] = 0;
    return out;
};

/**
 * Creates a new mat2d initialized with values from an existing matrix
 *
 * @param {mat2d} a matrix to clone
 * @returns {mat2d} a new 2x3 matrix
 */
mat2d.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(6);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    return out;
};

/**
 * Copy the values from one mat2d to another
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the source matrix
 * @returns {mat2d} out
 */
mat2d.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    return out;
};

/**
 * Set a mat2d to the identity matrix
 *
 * @param {mat2d} out the receiving matrix
 * @returns {mat2d} out
 */
mat2d.identity = function(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    out[4] = 0;
    out[5] = 0;
    return out;
};

/**
 * Inverts a mat2d
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the source matrix
 * @returns {mat2d} out
 */
mat2d.invert = function(out, a) {
    var aa = a[0], ab = a[1], ac = a[2], ad = a[3],
        atx = a[4], aty = a[5];

    var det = aa * ad - ab * ac;
    if(!det){
        return null;
    }
    det = 1.0 / det;

    out[0] = ad * det;
    out[1] = -ab * det;
    out[2] = -ac * det;
    out[3] = aa * det;
    out[4] = (ac * aty - ad * atx) * det;
    out[5] = (ab * atx - aa * aty) * det;
    return out;
};

/**
 * Calculates the determinant of a mat2d
 *
 * @param {mat2d} a the source matrix
 * @returns {Number} determinant of a
 */
mat2d.determinant = function (a) {
    return a[0] * a[3] - a[1] * a[2];
};

/**
 * Multiplies two mat2d's
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the first operand
 * @param {mat2d} b the second operand
 * @returns {mat2d} out
 */
mat2d.multiply = function (out, a, b) {
    var aa = a[0], ab = a[1], ac = a[2], ad = a[3],
        atx = a[4], aty = a[5],
        ba = b[0], bb = b[1], bc = b[2], bd = b[3],
        btx = b[4], bty = b[5];

    out[0] = aa*ba + ab*bc;
    out[1] = aa*bb + ab*bd;
    out[2] = ac*ba + ad*bc;
    out[3] = ac*bb + ad*bd;
    out[4] = ba*atx + bc*aty + btx;
    out[5] = bb*atx + bd*aty + bty;
    return out;
};

/**
 * Alias for {@link mat2d.multiply}
 * @function
 */
mat2d.mul = mat2d.multiply;


/**
 * Rotates a mat2d by the given angle
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat2d} out
 */
mat2d.rotate = function (out, a, rad) {
    var aa = a[0],
        ab = a[1],
        ac = a[2],
        ad = a[3],
        atx = a[4],
        aty = a[5],
        st = Math.sin(rad),
        ct = Math.cos(rad);

    out[0] = aa*ct + ab*st;
    out[1] = -aa*st + ab*ct;
    out[2] = ac*ct + ad*st;
    out[3] = -ac*st + ct*ad;
    out[4] = ct*atx + st*aty;
    out[5] = ct*aty - st*atx;
    return out;
};

/**
 * Scales the mat2d by the dimensions in the given vec2
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to translate
 * @param {vec2} v the vec2 to scale the matrix by
 * @returns {mat2d} out
 **/
mat2d.scale = function(out, a, v) {
    var vx = v[0], vy = v[1];
    out[0] = a[0] * vx;
    out[1] = a[1] * vy;
    out[2] = a[2] * vx;
    out[3] = a[3] * vy;
    out[4] = a[4] * vx;
    out[5] = a[5] * vy;
    return out;
};

/**
 * Translates the mat2d by the dimensions in the given vec2
 *
 * @param {mat2d} out the receiving matrix
 * @param {mat2d} a the matrix to translate
 * @param {vec2} v the vec2 to translate the matrix by
 * @returns {mat2d} out
 **/
mat2d.translate = function(out, a, v) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4] + v[0];
    out[5] = a[5] + v[1];
    return out;
};

/**
 * Returns a string representation of a mat2d
 *
 * @param {mat2d} a matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
mat2d.str = function (a) {
    return 'mat2d(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + 
                    a[3] + ', ' + a[4] + ', ' + a[5] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.mat2d = mat2d;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 3x3 Matrix
 * @name mat3
 */

var mat3 = {};

/**
 * Creates a new identity mat3
 *
 * @returns {mat3} a new 3x3 matrix
 */
mat3.create = function() {
    var out = new GLMAT_ARRAY_TYPE(9);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 1;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 1;
    return out;
};

/**
 * Copies the upper-left 3x3 values into the given mat3.
 *
 * @param {mat3} out the receiving 3x3 matrix
 * @param {mat4} a   the source 4x4 matrix
 * @returns {mat3} out
 */
mat3.fromMat4 = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[4];
    out[4] = a[5];
    out[5] = a[6];
    out[6] = a[8];
    out[7] = a[9];
    out[8] = a[10];
    return out;
};

/**
 * Creates a new mat3 initialized with values from an existing matrix
 *
 * @param {mat3} a matrix to clone
 * @returns {mat3} a new 3x3 matrix
 */
mat3.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(9);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return out;
};

/**
 * Copy the values from one mat3 to another
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */
mat3.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return out;
};

/**
 * Set a mat3 to the identity matrix
 *
 * @param {mat3} out the receiving matrix
 * @returns {mat3} out
 */
mat3.identity = function(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 1;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 1;
    return out;
};

/**
 * Transpose the values of a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */
mat3.transpose = function(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
        var a01 = a[1], a02 = a[2], a12 = a[5];
        out[1] = a[3];
        out[2] = a[6];
        out[3] = a01;
        out[5] = a[7];
        out[6] = a02;
        out[7] = a12;
    } else {
        out[0] = a[0];
        out[1] = a[3];
        out[2] = a[6];
        out[3] = a[1];
        out[4] = a[4];
        out[5] = a[7];
        out[6] = a[2];
        out[7] = a[5];
        out[8] = a[8];
    }
    
    return out;
};

/**
 * Inverts a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */
mat3.invert = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        b01 = a22 * a11 - a12 * a21,
        b11 = -a22 * a10 + a12 * a20,
        b21 = a21 * a10 - a11 * a20,

        // Calculate the determinant
        det = a00 * b01 + a01 * b11 + a02 * b21;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    out[0] = b01 * det;
    out[1] = (-a22 * a01 + a02 * a21) * det;
    out[2] = (a12 * a01 - a02 * a11) * det;
    out[3] = b11 * det;
    out[4] = (a22 * a00 - a02 * a20) * det;
    out[5] = (-a12 * a00 + a02 * a10) * det;
    out[6] = b21 * det;
    out[7] = (-a21 * a00 + a01 * a20) * det;
    out[8] = (a11 * a00 - a01 * a10) * det;
    return out;
};

/**
 * Calculates the adjugate of a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the source matrix
 * @returns {mat3} out
 */
mat3.adjoint = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8];

    out[0] = (a11 * a22 - a12 * a21);
    out[1] = (a02 * a21 - a01 * a22);
    out[2] = (a01 * a12 - a02 * a11);
    out[3] = (a12 * a20 - a10 * a22);
    out[4] = (a00 * a22 - a02 * a20);
    out[5] = (a02 * a10 - a00 * a12);
    out[6] = (a10 * a21 - a11 * a20);
    out[7] = (a01 * a20 - a00 * a21);
    out[8] = (a00 * a11 - a01 * a10);
    return out;
};

/**
 * Calculates the determinant of a mat3
 *
 * @param {mat3} a the source matrix
 * @returns {Number} determinant of a
 */
mat3.determinant = function (a) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8];

    return a00 * (a22 * a11 - a12 * a21) + a01 * (-a22 * a10 + a12 * a20) + a02 * (a21 * a10 - a11 * a20);
};

/**
 * Multiplies two mat3's
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the first operand
 * @param {mat3} b the second operand
 * @returns {mat3} out
 */
mat3.multiply = function (out, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        b00 = b[0], b01 = b[1], b02 = b[2],
        b10 = b[3], b11 = b[4], b12 = b[5],
        b20 = b[6], b21 = b[7], b22 = b[8];

    out[0] = b00 * a00 + b01 * a10 + b02 * a20;
    out[1] = b00 * a01 + b01 * a11 + b02 * a21;
    out[2] = b00 * a02 + b01 * a12 + b02 * a22;

    out[3] = b10 * a00 + b11 * a10 + b12 * a20;
    out[4] = b10 * a01 + b11 * a11 + b12 * a21;
    out[5] = b10 * a02 + b11 * a12 + b12 * a22;

    out[6] = b20 * a00 + b21 * a10 + b22 * a20;
    out[7] = b20 * a01 + b21 * a11 + b22 * a21;
    out[8] = b20 * a02 + b21 * a12 + b22 * a22;
    return out;
};

/**
 * Alias for {@link mat3.multiply}
 * @function
 */
mat3.mul = mat3.multiply;

/**
 * Translate a mat3 by the given vector
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the matrix to translate
 * @param {vec2} v vector to translate by
 * @returns {mat3} out
 */
mat3.translate = function(out, a, v) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],
        x = v[0], y = v[1];

    out[0] = a00;
    out[1] = a01;
    out[2] = a02;

    out[3] = a10;
    out[4] = a11;
    out[5] = a12;

    out[6] = x * a00 + y * a10 + a20;
    out[7] = x * a01 + y * a11 + a21;
    out[8] = x * a02 + y * a12 + a22;
    return out;
};

/**
 * Rotates a mat3 by the given angle
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat3} out
 */
mat3.rotate = function (out, a, rad) {
    var a00 = a[0], a01 = a[1], a02 = a[2],
        a10 = a[3], a11 = a[4], a12 = a[5],
        a20 = a[6], a21 = a[7], a22 = a[8],

        s = Math.sin(rad),
        c = Math.cos(rad);

    out[0] = c * a00 + s * a10;
    out[1] = c * a01 + s * a11;
    out[2] = c * a02 + s * a12;

    out[3] = c * a10 - s * a00;
    out[4] = c * a11 - s * a01;
    out[5] = c * a12 - s * a02;

    out[6] = a20;
    out[7] = a21;
    out[8] = a22;
    return out;
};

/**
 * Scales the mat3 by the dimensions in the given vec2
 *
 * @param {mat3} out the receiving matrix
 * @param {mat3} a the matrix to rotate
 * @param {vec2} v the vec2 to scale the matrix by
 * @returns {mat3} out
 **/
mat3.scale = function(out, a, v) {
    var x = v[0], y = v[1];

    out[0] = x * a[0];
    out[1] = x * a[1];
    out[2] = x * a[2];

    out[3] = y * a[3];
    out[4] = y * a[4];
    out[5] = y * a[5];

    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    return out;
};

/**
 * Copies the values from a mat2d into a mat3
 *
 * @param {mat3} out the receiving matrix
 * @param {mat2d} a the matrix to copy
 * @returns {mat3} out
 **/
mat3.fromMat2d = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = 0;

    out[3] = a[2];
    out[4] = a[3];
    out[5] = 0;

    out[6] = a[4];
    out[7] = a[5];
    out[8] = 1;
    return out;
};

/**
* Calculates a 3x3 matrix from the given quaternion
*
* @param {mat3} out mat3 receiving operation result
* @param {quat} q Quaternion to create matrix from
*
* @returns {mat3} out
*/
mat3.fromQuat = function (out, q) {
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        xy = x * y2,
        xz = x * z2,
        yy = y * y2,
        yz = y * z2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - (yy + zz);
    out[3] = xy + wz;
    out[6] = xz - wy;

    out[1] = xy - wz;
    out[4] = 1 - (xx + zz);
    out[7] = yz + wx;

    out[2] = xz + wy;
    out[5] = yz - wx;
    out[8] = 1 - (xx + yy);

    return out;
};

/**
* Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix
*
* @param {mat3} out mat3 receiving operation result
* @param {mat4} a Mat4 to derive the normal matrix from
*
* @returns {mat3} out
*/
mat3.normalFromMat4 = function (out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32,

        // Calculate the determinant
        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;

    out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;

    out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;

    return out;
};

/**
 * Returns a string representation of a mat3
 *
 * @param {mat3} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
mat3.str = function (a) {
    return 'mat3(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + 
                    a[3] + ', ' + a[4] + ', ' + a[5] + ', ' + 
                    a[6] + ', ' + a[7] + ', ' + a[8] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.mat3 = mat3;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class 4x4 Matrix
 * @name mat4
 */

var mat4 = {};

/**
 * Creates a new identity mat4
 *
 * @returns {mat4} a new 4x4 matrix
 */
mat4.create = function() {
    var out = new GLMAT_ARRAY_TYPE(16);
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
};

/**
 * Creates a new mat4 initialized with values from an existing matrix
 *
 * @param {mat4} a matrix to clone
 * @returns {mat4} a new 4x4 matrix
 */
mat4.clone = function(a) {
    var out = new GLMAT_ARRAY_TYPE(16);
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};

/**
 * Copy the values from one mat4 to another
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
mat4.copy = function(out, a) {
    out[0] = a[0];
    out[1] = a[1];
    out[2] = a[2];
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    out[6] = a[6];
    out[7] = a[7];
    out[8] = a[8];
    out[9] = a[9];
    out[10] = a[10];
    out[11] = a[11];
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};

/**
 * Set a mat4 to the identity matrix
 *
 * @param {mat4} out the receiving matrix
 * @returns {mat4} out
 */
mat4.identity = function(out) {
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = 1;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 1;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;
    return out;
};

/**
 * Transpose the values of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
mat4.transpose = function(out, a) {
    // If we are transposing ourselves we can skip a few steps but have to cache some values
    if (out === a) {
        var a01 = a[1], a02 = a[2], a03 = a[3],
            a12 = a[6], a13 = a[7],
            a23 = a[11];

        out[1] = a[4];
        out[2] = a[8];
        out[3] = a[12];
        out[4] = a01;
        out[6] = a[9];
        out[7] = a[13];
        out[8] = a02;
        out[9] = a12;
        out[11] = a[14];
        out[12] = a03;
        out[13] = a13;
        out[14] = a23;
    } else {
        out[0] = a[0];
        out[1] = a[4];
        out[2] = a[8];
        out[3] = a[12];
        out[4] = a[1];
        out[5] = a[5];
        out[6] = a[9];
        out[7] = a[13];
        out[8] = a[2];
        out[9] = a[6];
        out[10] = a[10];
        out[11] = a[14];
        out[12] = a[3];
        out[13] = a[7];
        out[14] = a[11];
        out[15] = a[15];
    }
    
    return out;
};

/**
 * Inverts a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
mat4.invert = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32,

        // Calculate the determinant
        det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (!det) { 
        return null; 
    }
    det = 1.0 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return out;
};

/**
 * Calculates the adjugate of a mat4
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the source matrix
 * @returns {mat4} out
 */
mat4.adjoint = function(out, a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    out[0]  =  (a11 * (a22 * a33 - a23 * a32) - a21 * (a12 * a33 - a13 * a32) + a31 * (a12 * a23 - a13 * a22));
    out[1]  = -(a01 * (a22 * a33 - a23 * a32) - a21 * (a02 * a33 - a03 * a32) + a31 * (a02 * a23 - a03 * a22));
    out[2]  =  (a01 * (a12 * a33 - a13 * a32) - a11 * (a02 * a33 - a03 * a32) + a31 * (a02 * a13 - a03 * a12));
    out[3]  = -(a01 * (a12 * a23 - a13 * a22) - a11 * (a02 * a23 - a03 * a22) + a21 * (a02 * a13 - a03 * a12));
    out[4]  = -(a10 * (a22 * a33 - a23 * a32) - a20 * (a12 * a33 - a13 * a32) + a30 * (a12 * a23 - a13 * a22));
    out[5]  =  (a00 * (a22 * a33 - a23 * a32) - a20 * (a02 * a33 - a03 * a32) + a30 * (a02 * a23 - a03 * a22));
    out[6]  = -(a00 * (a12 * a33 - a13 * a32) - a10 * (a02 * a33 - a03 * a32) + a30 * (a02 * a13 - a03 * a12));
    out[7]  =  (a00 * (a12 * a23 - a13 * a22) - a10 * (a02 * a23 - a03 * a22) + a20 * (a02 * a13 - a03 * a12));
    out[8]  =  (a10 * (a21 * a33 - a23 * a31) - a20 * (a11 * a33 - a13 * a31) + a30 * (a11 * a23 - a13 * a21));
    out[9]  = -(a00 * (a21 * a33 - a23 * a31) - a20 * (a01 * a33 - a03 * a31) + a30 * (a01 * a23 - a03 * a21));
    out[10] =  (a00 * (a11 * a33 - a13 * a31) - a10 * (a01 * a33 - a03 * a31) + a30 * (a01 * a13 - a03 * a11));
    out[11] = -(a00 * (a11 * a23 - a13 * a21) - a10 * (a01 * a23 - a03 * a21) + a20 * (a01 * a13 - a03 * a11));
    out[12] = -(a10 * (a21 * a32 - a22 * a31) - a20 * (a11 * a32 - a12 * a31) + a30 * (a11 * a22 - a12 * a21));
    out[13] =  (a00 * (a21 * a32 - a22 * a31) - a20 * (a01 * a32 - a02 * a31) + a30 * (a01 * a22 - a02 * a21));
    out[14] = -(a00 * (a11 * a32 - a12 * a31) - a10 * (a01 * a32 - a02 * a31) + a30 * (a01 * a12 - a02 * a11));
    out[15] =  (a00 * (a11 * a22 - a12 * a21) - a10 * (a01 * a22 - a02 * a21) + a20 * (a01 * a12 - a02 * a11));
    return out;
};

/**
 * Calculates the determinant of a mat4
 *
 * @param {mat4} a the source matrix
 * @returns {Number} determinant of a
 */
mat4.determinant = function (a) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15],

        b00 = a00 * a11 - a01 * a10,
        b01 = a00 * a12 - a02 * a10,
        b02 = a00 * a13 - a03 * a10,
        b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11,
        b05 = a02 * a13 - a03 * a12,
        b06 = a20 * a31 - a21 * a30,
        b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30,
        b09 = a21 * a32 - a22 * a31,
        b10 = a21 * a33 - a23 * a31,
        b11 = a22 * a33 - a23 * a32;

    // Calculate the determinant
    return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
};

/**
 * Multiplies two mat4's
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the first operand
 * @param {mat4} b the second operand
 * @returns {mat4} out
 */
mat4.multiply = function (out, a, b) {
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    // Cache only the current line of the second matrix
    var b0  = b[0], b1 = b[1], b2 = b[2], b3 = b[3];  
    out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    return out;
};

/**
 * Alias for {@link mat4.multiply}
 * @function
 */
mat4.mul = mat4.multiply;

/**
 * Translate a mat4 by the given vector
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to translate
 * @param {vec3} v vector to translate by
 * @returns {mat4} out
 */
mat4.translate = function (out, a, v) {
    var x = v[0], y = v[1], z = v[2],
        a00, a01, a02, a03,
        a10, a11, a12, a13,
        a20, a21, a22, a23;

    if (a === out) {
        out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
        out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
        out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
        out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    } else {
        a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
        a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
        a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

        out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
        out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
        out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;

        out[12] = a00 * x + a10 * y + a20 * z + a[12];
        out[13] = a01 * x + a11 * y + a21 * z + a[13];
        out[14] = a02 * x + a12 * y + a22 * z + a[14];
        out[15] = a03 * x + a13 * y + a23 * z + a[15];
    }

    return out;
};

/**
 * Scales the mat4 by the dimensions in the given vec3
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to scale
 * @param {vec3} v the vec3 to scale the matrix by
 * @returns {mat4} out
 **/
mat4.scale = function(out, a, v) {
    var x = v[0], y = v[1], z = v[2];

    out[0] = a[0] * x;
    out[1] = a[1] * x;
    out[2] = a[2] * x;
    out[3] = a[3] * x;
    out[4] = a[4] * y;
    out[5] = a[5] * y;
    out[6] = a[6] * y;
    out[7] = a[7] * y;
    out[8] = a[8] * z;
    out[9] = a[9] * z;
    out[10] = a[10] * z;
    out[11] = a[11] * z;
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
    return out;
};

/**
 * Rotates a mat4 by the given angle
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @param {vec3} axis the axis to rotate around
 * @returns {mat4} out
 */
mat4.rotate = function (out, a, rad, axis) {
    var x = axis[0], y = axis[1], z = axis[2],
        len = Math.sqrt(x * x + y * y + z * z),
        s, c, t,
        a00, a01, a02, a03,
        a10, a11, a12, a13,
        a20, a21, a22, a23,
        b00, b01, b02,
        b10, b11, b12,
        b20, b21, b22;

    if (Math.abs(len) < GLMAT_EPSILON) { return null; }
    
    len = 1 / len;
    x *= len;
    y *= len;
    z *= len;

    s = Math.sin(rad);
    c = Math.cos(rad);
    t = 1 - c;

    a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
    a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
    a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];

    // Construct the elements of the rotation matrix
    b00 = x * x * t + c; b01 = y * x * t + z * s; b02 = z * x * t - y * s;
    b10 = x * y * t - z * s; b11 = y * y * t + c; b12 = z * y * t + x * s;
    b20 = x * z * t + y * s; b21 = y * z * t - x * s; b22 = z * z * t + c;

    // Perform rotation-specific matrix multiplication
    out[0] = a00 * b00 + a10 * b01 + a20 * b02;
    out[1] = a01 * b00 + a11 * b01 + a21 * b02;
    out[2] = a02 * b00 + a12 * b01 + a22 * b02;
    out[3] = a03 * b00 + a13 * b01 + a23 * b02;
    out[4] = a00 * b10 + a10 * b11 + a20 * b12;
    out[5] = a01 * b10 + a11 * b11 + a21 * b12;
    out[6] = a02 * b10 + a12 * b11 + a22 * b12;
    out[7] = a03 * b10 + a13 * b11 + a23 * b12;
    out[8] = a00 * b20 + a10 * b21 + a20 * b22;
    out[9] = a01 * b20 + a11 * b21 + a21 * b22;
    out[10] = a02 * b20 + a12 * b21 + a22 * b22;
    out[11] = a03 * b20 + a13 * b21 + a23 * b22;

    if (a !== out) { // If the source and destination differ, copy the unchanged last row
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }
    return out;
};

/**
 * Rotates a matrix by the given angle around the X axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
mat4.rotateX = function (out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7],
        a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];

    if (a !== out) { // If the source and destination differ, copy the unchanged rows
        out[0]  = a[0];
        out[1]  = a[1];
        out[2]  = a[2];
        out[3]  = a[3];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    return out;
};

/**
 * Rotates a matrix by the given angle around the Y axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
mat4.rotateY = function (out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3],
        a20 = a[8],
        a21 = a[9],
        a22 = a[10],
        a23 = a[11];

    if (a !== out) { // If the source and destination differ, copy the unchanged rows
        out[4]  = a[4];
        out[5]  = a[5];
        out[6]  = a[6];
        out[7]  = a[7];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    return out;
};

/**
 * Rotates a matrix by the given angle around the Z axis
 *
 * @param {mat4} out the receiving matrix
 * @param {mat4} a the matrix to rotate
 * @param {Number} rad the angle to rotate the matrix by
 * @returns {mat4} out
 */
mat4.rotateZ = function (out, a, rad) {
    var s = Math.sin(rad),
        c = Math.cos(rad),
        a00 = a[0],
        a01 = a[1],
        a02 = a[2],
        a03 = a[3],
        a10 = a[4],
        a11 = a[5],
        a12 = a[6],
        a13 = a[7];

    if (a !== out) { // If the source and destination differ, copy the unchanged last row
        out[8]  = a[8];
        out[9]  = a[9];
        out[10] = a[10];
        out[11] = a[11];
        out[12] = a[12];
        out[13] = a[13];
        out[14] = a[14];
        out[15] = a[15];
    }

    // Perform axis-specific matrix multiplication
    out[0] = a00 * c + a10 * s;
    out[1] = a01 * c + a11 * s;
    out[2] = a02 * c + a12 * s;
    out[3] = a03 * c + a13 * s;
    out[4] = a10 * c - a00 * s;
    out[5] = a11 * c - a01 * s;
    out[6] = a12 * c - a02 * s;
    out[7] = a13 * c - a03 * s;
    return out;
};

/**
 * Creates a matrix from a quaternion rotation and vector translation
 * This is equivalent to (but much faster than):
 *
 *     mat4.identity(dest);
 *     mat4.translate(dest, vec);
 *     var quatMat = mat4.create();
 *     quat4.toMat4(quat, quatMat);
 *     mat4.multiply(dest, quatMat);
 *
 * @param {mat4} out mat4 receiving operation result
 * @param {quat4} q Rotation quaternion
 * @param {vec3} v Translation vector
 * @returns {mat4} out
 */
mat4.fromRotationTranslation = function (out, q, v) {
    // Quaternion math
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        xy = x * y2,
        xz = x * z2,
        yy = y * y2,
        yz = y * z2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - (yy + zz);
    out[1] = xy + wz;
    out[2] = xz - wy;
    out[3] = 0;
    out[4] = xy - wz;
    out[5] = 1 - (xx + zz);
    out[6] = yz + wx;
    out[7] = 0;
    out[8] = xz + wy;
    out[9] = yz - wx;
    out[10] = 1 - (xx + yy);
    out[11] = 0;
    out[12] = v[0];
    out[13] = v[1];
    out[14] = v[2];
    out[15] = 1;
    
    return out;
};

/**
* Calculates a 4x4 matrix from the given quaternion
*
* @param {mat4} out mat4 receiving operation result
* @param {quat} q Quaternion to create matrix from
*
* @returns {mat4} out
*/
mat4.fromQuat = function (out, q) {
    var x = q[0], y = q[1], z = q[2], w = q[3],
        x2 = x + x,
        y2 = y + y,
        z2 = z + z,

        xx = x * x2,
        xy = x * y2,
        xz = x * z2,
        yy = y * y2,
        yz = y * z2,
        zz = z * z2,
        wx = w * x2,
        wy = w * y2,
        wz = w * z2;

    out[0] = 1 - (yy + zz);
    out[1] = xy + wz;
    out[2] = xz - wy;
    out[3] = 0;

    out[4] = xy - wz;
    out[5] = 1 - (xx + zz);
    out[6] = yz + wx;
    out[7] = 0;

    out[8] = xz + wy;
    out[9] = yz - wx;
    out[10] = 1 - (xx + yy);
    out[11] = 0;

    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
    out[15] = 1;

    return out;
};

/**
 * Generates a frustum matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {Number} left Left bound of the frustum
 * @param {Number} right Right bound of the frustum
 * @param {Number} bottom Bottom bound of the frustum
 * @param {Number} top Top bound of the frustum
 * @param {Number} near Near bound of the frustum
 * @param {Number} far Far bound of the frustum
 * @returns {mat4} out
 */
mat4.frustum = function (out, left, right, bottom, top, near, far) {
    var rl = 1 / (right - left),
        tb = 1 / (top - bottom),
        nf = 1 / (near - far);
    out[0] = (near * 2) * rl;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = (near * 2) * tb;
    out[6] = 0;
    out[7] = 0;
    out[8] = (right + left) * rl;
    out[9] = (top + bottom) * tb;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (far * near * 2) * nf;
    out[15] = 0;
    return out;
};

/**
 * Generates a perspective projection matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} fovy Vertical field of view in radians
 * @param {number} aspect Aspect ratio. typically viewport width/height
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
mat4.perspective = function (out, fovy, aspect, near, far) {
    var f = 1.0 / Math.tan(fovy / 2),
        nf = 1 / (near - far);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) * nf;
    out[15] = 0;
    return out;
};

/**
 * Generates a orthogonal projection matrix with the given bounds
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {number} left Left bound of the frustum
 * @param {number} right Right bound of the frustum
 * @param {number} bottom Bottom bound of the frustum
 * @param {number} top Top bound of the frustum
 * @param {number} near Near bound of the frustum
 * @param {number} far Far bound of the frustum
 * @returns {mat4} out
 */
mat4.ortho = function (out, left, right, bottom, top, near, far) {
    var lr = 1 / (left - right),
        bt = 1 / (bottom - top),
        nf = 1 / (near - far);
    out[0] = -2 * lr;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = -2 * bt;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = 2 * nf;
    out[11] = 0;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
};

/**
 * Generates a look-at matrix with the given eye position, focal point, and up axis
 *
 * @param {mat4} out mat4 frustum matrix will be written into
 * @param {vec3} eye Position of the viewer
 * @param {vec3} center Point the viewer is looking at
 * @param {vec3} up vec3 pointing up
 * @returns {mat4} out
 */
mat4.lookAt = function (out, eye, center, up) {
    var x0, x1, x2, y0, y1, y2, z0, z1, z2, len,
        eyex = eye[0],
        eyey = eye[1],
        eyez = eye[2],
        upx = up[0],
        upy = up[1],
        upz = up[2],
        centerx = center[0],
        centery = center[1],
        centerz = center[2];

    if (Math.abs(eyex - centerx) < GLMAT_EPSILON &&
        Math.abs(eyey - centery) < GLMAT_EPSILON &&
        Math.abs(eyez - centerz) < GLMAT_EPSILON) {
        return mat4.identity(out);
    }

    z0 = eyex - centerx;
    z1 = eyey - centery;
    z2 = eyez - centerz;

    len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
    z0 *= len;
    z1 *= len;
    z2 *= len;

    x0 = upy * z2 - upz * z1;
    x1 = upz * z0 - upx * z2;
    x2 = upx * z1 - upy * z0;
    len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
    if (!len) {
        x0 = 0;
        x1 = 0;
        x2 = 0;
    } else {
        len = 1 / len;
        x0 *= len;
        x1 *= len;
        x2 *= len;
    }

    y0 = z1 * x2 - z2 * x1;
    y1 = z2 * x0 - z0 * x2;
    y2 = z0 * x1 - z1 * x0;

    len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
    if (!len) {
        y0 = 0;
        y1 = 0;
        y2 = 0;
    } else {
        len = 1 / len;
        y0 *= len;
        y1 *= len;
        y2 *= len;
    }

    out[0] = x0;
    out[1] = y0;
    out[2] = z0;
    out[3] = 0;
    out[4] = x1;
    out[5] = y1;
    out[6] = z1;
    out[7] = 0;
    out[8] = x2;
    out[9] = y2;
    out[10] = z2;
    out[11] = 0;
    out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
    out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
    out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
    out[15] = 1;

    return out;
};

/**
 * Returns a string representation of a mat4
 *
 * @param {mat4} mat matrix to represent as a string
 * @returns {String} string representation of the matrix
 */
mat4.str = function (a) {
    return 'mat4(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ', ' +
                    a[4] + ', ' + a[5] + ', ' + a[6] + ', ' + a[7] + ', ' +
                    a[8] + ', ' + a[9] + ', ' + a[10] + ', ' + a[11] + ', ' + 
                    a[12] + ', ' + a[13] + ', ' + a[14] + ', ' + a[15] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.mat4 = mat4;
}
;
/* Copyright (c) 2013, Brandon Jones, Colin MacKenzie IV. All rights reserved.

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

  * Redistributions of source code must retain the above copyright notice, this
    list of conditions and the following disclaimer.
  * Redistributions in binary form must reproduce the above copyright notice,
    this list of conditions and the following disclaimer in the documentation 
    and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE. */

/**
 * @class Quaternion
 * @name quat
 */

var quat = {};

/**
 * Creates a new identity quat
 *
 * @returns {quat} a new quaternion
 */
quat.create = function() {
    var out = new GLMAT_ARRAY_TYPE(4);
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
};

/**
 * Sets a quaternion to represent the shortest rotation from one
 * vector to another.
 *
 * Both vectors are assumed to be unit length.
 *
 * @param {quat} out the receiving quaternion.
 * @param {vec3} a the initial vector
 * @param {vec3} b the destination vector
 * @returns {quat} out
 */
quat.rotationTo = (function() {
    var tmpvec3 = vec3.create();
    var xUnitVec3 = vec3.fromValues(1,0,0);
    var yUnitVec3 = vec3.fromValues(0,1,0);

    return function(out, a, b) {
        var dot = vec3.dot(a, b);
        if (dot < -0.999999) {
            vec3.cross(tmpvec3, xUnitVec3, a);
            if (vec3.length(tmpvec3) < 0.000001)
                vec3.cross(tmpvec3, yUnitVec3, a);
            vec3.normalize(tmpvec3, tmpvec3);
            quat.setAxisAngle(out, tmpvec3, Math.PI);
            return out;
        } else if (dot > 0.999999) {
            out[0] = 0;
            out[1] = 0;
            out[2] = 0;
            out[3] = 1;
            return out;
        } else {
            vec3.cross(tmpvec3, a, b);
            out[0] = tmpvec3[0];
            out[1] = tmpvec3[1];
            out[2] = tmpvec3[2];
            out[3] = 1 + dot;
            return quat.normalize(out, out);
        }
    };
})();

/**
 * Sets the specified quaternion with values corresponding to the given
 * axes. Each axis is a vec3 and is expected to be unit length and
 * perpendicular to all other specified axes.
 *
 * @param {vec3} view  the vector representing the viewing direction
 * @param {vec3} right the vector representing the local "right" direction
 * @param {vec3} up    the vector representing the local "up" direction
 * @returns {quat} out
 */
quat.setAxes = (function() {
    var matr = mat3.create();

    return function(out, view, right, up) {
        matr[0] = right[0];
        matr[3] = right[1];
        matr[6] = right[2];

        matr[1] = up[0];
        matr[4] = up[1];
        matr[7] = up[2];

        matr[2] = view[0];
        matr[5] = view[1];
        matr[8] = view[2];

        return quat.normalize(out, quat.fromMat3(out, matr));
    };
})();

/**
 * Creates a new quat initialized with values from an existing quaternion
 *
 * @param {quat} a quaternion to clone
 * @returns {quat} a new quaternion
 * @function
 */
quat.clone = vec4.clone;

/**
 * Creates a new quat initialized with the given values
 *
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {quat} a new quaternion
 * @function
 */
quat.fromValues = vec4.fromValues;

/**
 * Copy the values from one quat to another
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the source quaternion
 * @returns {quat} out
 * @function
 */
quat.copy = vec4.copy;

/**
 * Set the components of a quat to the given values
 *
 * @param {quat} out the receiving quaternion
 * @param {Number} x X component
 * @param {Number} y Y component
 * @param {Number} z Z component
 * @param {Number} w W component
 * @returns {quat} out
 * @function
 */
quat.set = vec4.set;

/**
 * Set a quat to the identity quaternion
 *
 * @param {quat} out the receiving quaternion
 * @returns {quat} out
 */
quat.identity = function(out) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 1;
    return out;
};

/**
 * Sets a quat from the given angle and rotation axis,
 * then returns it.
 *
 * @param {quat} out the receiving quaternion
 * @param {vec3} axis the axis around which to rotate
 * @param {Number} rad the angle in radians
 * @returns {quat} out
 **/
quat.setAxisAngle = function(out, axis, rad) {
    rad = rad * 0.5;
    var s = Math.sin(rad);
    out[0] = s * axis[0];
    out[1] = s * axis[1];
    out[2] = s * axis[2];
    out[3] = Math.cos(rad);
    return out;
};

/**
 * Adds two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {quat} out
 * @function
 */
quat.add = vec4.add;

/**
 * Multiplies two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {quat} out
 */
quat.multiply = function(out, a, b) {
    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        bx = b[0], by = b[1], bz = b[2], bw = b[3];

    out[0] = ax * bw + aw * bx + ay * bz - az * by;
    out[1] = ay * bw + aw * by + az * bx - ax * bz;
    out[2] = az * bw + aw * bz + ax * by - ay * bx;
    out[3] = aw * bw - ax * bx - ay * by - az * bz;
    return out;
};

/**
 * Alias for {@link quat.multiply}
 * @function
 */
quat.mul = quat.multiply;

/**
 * Scales a quat by a scalar number
 *
 * @param {quat} out the receiving vector
 * @param {quat} a the vector to scale
 * @param {Number} b amount to scale the vector by
 * @returns {quat} out
 * @function
 */
quat.scale = vec4.scale;

/**
 * Rotates a quaternion by the given angle about the X axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
quat.rotateX = function (out, a, rad) {
    rad *= 0.5; 

    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        bx = Math.sin(rad), bw = Math.cos(rad);

    out[0] = ax * bw + aw * bx;
    out[1] = ay * bw + az * bx;
    out[2] = az * bw - ay * bx;
    out[3] = aw * bw - ax * bx;
    return out;
};

/**
 * Rotates a quaternion by the given angle about the Y axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
quat.rotateY = function (out, a, rad) {
    rad *= 0.5; 

    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        by = Math.sin(rad), bw = Math.cos(rad);

    out[0] = ax * bw - az * by;
    out[1] = ay * bw + aw * by;
    out[2] = az * bw + ax * by;
    out[3] = aw * bw - ay * by;
    return out;
};

/**
 * Rotates a quaternion by the given angle about the Z axis
 *
 * @param {quat} out quat receiving operation result
 * @param {quat} a quat to rotate
 * @param {number} rad angle (in radians) to rotate
 * @returns {quat} out
 */
quat.rotateZ = function (out, a, rad) {
    rad *= 0.5; 

    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        bz = Math.sin(rad), bw = Math.cos(rad);

    out[0] = ax * bw + ay * bz;
    out[1] = ay * bw - ax * bz;
    out[2] = az * bw + aw * bz;
    out[3] = aw * bw - az * bz;
    return out;
};

/**
 * Calculates the W component of a quat from the X, Y, and Z components.
 * Assumes that quaternion is 1 unit in length.
 * Any existing W component will be ignored.
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate W component of
 * @returns {quat} out
 */
quat.calculateW = function (out, a) {
    var x = a[0], y = a[1], z = a[2];

    out[0] = x;
    out[1] = y;
    out[2] = z;
    out[3] = -Math.sqrt(Math.abs(1.0 - x * x - y * y - z * z));
    return out;
};

/**
 * Calculates the dot product of two quat's
 *
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @returns {Number} dot product of a and b
 * @function
 */
quat.dot = vec4.dot;

/**
 * Performs a linear interpolation between two quat's
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {quat} out
 * @function
 */
quat.lerp = vec4.lerp;

/**
 * Performs a spherical linear interpolation between two quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a the first operand
 * @param {quat} b the second operand
 * @param {Number} t interpolation amount between the two inputs
 * @returns {quat} out
 */
quat.slerp = function (out, a, b, t) {
    // benchmarks:
    //    http://jsperf.com/quaternion-slerp-implementations

    var ax = a[0], ay = a[1], az = a[2], aw = a[3],
        bx = b[0], by = b[1], bz = b[2], bw = b[3];

    var        omega, cosom, sinom, scale0, scale1;

    // calc cosine
    cosom = ax * bx + ay * by + az * bz + aw * bw;
    // adjust signs (if necessary)
    if ( cosom < 0.0 ) {
        cosom = -cosom;
        bx = - bx;
        by = - by;
        bz = - bz;
        bw = - bw;
    }
    // calculate coefficients
    if ( (1.0 - cosom) > 0.000001 ) {
        // standard case (slerp)
        omega  = Math.acos(cosom);
        sinom  = Math.sin(omega);
        scale0 = Math.sin((1.0 - t) * omega) / sinom;
        scale1 = Math.sin(t * omega) / sinom;
    } else {        
        // "from" and "to" quaternions are very close 
        //  ... so we can do a linear interpolation
        scale0 = 1.0 - t;
        scale1 = t;
    }
    // calculate final values
    out[0] = scale0 * ax + scale1 * bx;
    out[1] = scale0 * ay + scale1 * by;
    out[2] = scale0 * az + scale1 * bz;
    out[3] = scale0 * aw + scale1 * bw;
    
    return out;
};

/**
 * Calculates the inverse of a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate inverse of
 * @returns {quat} out
 */
quat.invert = function(out, a) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3],
        dot = a0*a0 + a1*a1 + a2*a2 + a3*a3,
        invDot = dot ? 1.0/dot : 0;
    
    // TODO: Would be faster to return [0,0,0,0] immediately if dot == 0

    out[0] = -a0*invDot;
    out[1] = -a1*invDot;
    out[2] = -a2*invDot;
    out[3] = a3*invDot;
    return out;
};

/**
 * Calculates the conjugate of a quat
 * If the quaternion is normalized, this function is faster than quat.inverse and produces the same result.
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quat to calculate conjugate of
 * @returns {quat} out
 */
quat.conjugate = function (out, a) {
    out[0] = -a[0];
    out[1] = -a[1];
    out[2] = -a[2];
    out[3] = a[3];
    return out;
};

/**
 * Calculates the length of a quat
 *
 * @param {quat} a vector to calculate length of
 * @returns {Number} length of a
 * @function
 */
quat.length = vec4.length;

/**
 * Alias for {@link quat.length}
 * @function
 */
quat.len = quat.length;

/**
 * Calculates the squared length of a quat
 *
 * @param {quat} a vector to calculate squared length of
 * @returns {Number} squared length of a
 * @function
 */
quat.squaredLength = vec4.squaredLength;

/**
 * Alias for {@link quat.squaredLength}
 * @function
 */
quat.sqrLen = quat.squaredLength;

/**
 * Normalize a quat
 *
 * @param {quat} out the receiving quaternion
 * @param {quat} a quaternion to normalize
 * @returns {quat} out
 * @function
 */
quat.normalize = vec4.normalize;

/**
 * Creates a quaternion from the given 3x3 rotation matrix.
 *
 * NOTE: The resultant quaternion is not normalized, so you should be sure
 * to renormalize the quaternion yourself where necessary.
 *
 * @param {quat} out the receiving quaternion
 * @param {mat3} m rotation matrix
 * @returns {quat} out
 * @function
 */
quat.fromMat3 = (function() {
    // benchmarks:
    //    http://jsperf.com/typed-array-access-speed
    //    http://jsperf.com/conversion-of-3x3-matrix-to-quaternion

    var s_iNext = (typeof(Int8Array) !== 'undefined' ? new Int8Array([1,2,0]) : [1,2,0]);

    return function(out, m) {
        // Algorithm in Ken Shoemake's article in 1987 SIGGRAPH course notes
        // article "Quaternion Calculus and Fast Animation".
        var fTrace = m[0] + m[4] + m[8];
        var fRoot;

        if ( fTrace > 0.0 ) {
            // |w| > 1/2, may as well choose w > 1/2
            fRoot = Math.sqrt(fTrace + 1.0);  // 2w
            out[3] = 0.5 * fRoot;
            fRoot = 0.5/fRoot;  // 1/(4w)
            out[0] = (m[7]-m[5])*fRoot;
            out[1] = (m[2]-m[6])*fRoot;
            out[2] = (m[3]-m[1])*fRoot;
        } else {
            // |w| <= 1/2
            var i = 0;
            if ( m[4] > m[0] )
              i = 1;
            if ( m[8] > m[i*3+i] )
              i = 2;
            var j = s_iNext[i];
            var k = s_iNext[j];
            
            fRoot = Math.sqrt(m[i*3+i]-m[j*3+j]-m[k*3+k] + 1.0);
            out[i] = 0.5 * fRoot;
            fRoot = 0.5 / fRoot;
            out[3] = (m[k*3+j] - m[j*3+k]) * fRoot;
            out[j] = (m[j*3+i] + m[i*3+j]) * fRoot;
            out[k] = (m[k*3+i] + m[i*3+k]) * fRoot;
        }
        
        return out;
    };
})();

/**
 * Returns a string representation of a quatenion
 *
 * @param {quat} vec vector to represent as a string
 * @returns {String} string representation of the vector
 */
quat.str = function (a) {
    return 'quat(' + a[0] + ', ' + a[1] + ', ' + a[2] + ', ' + a[3] + ')';
};

if(typeof(exports) !== 'undefined') {
    exports.quat = quat;
}
;













  })(shim.exports);
})(this);

/**
 * Style
 * @config  fillStyle | fill,
 * @config  strokeStyle | stroke,
 * @config  lineWidth,
 * @config  shadowColor,
 * @config  shadowOffsetX,
 * @config  shadowOffsetY,
 * @config  shadowBlur,
 * @config  globalAlpha | alpha
 * @config  shadow
 */
define('2d/style',['require','core/base','_'],function(require){
    
    var Base = require('core/base');
    var _ = require('_');

    var _styles = ['fillStyle', 
                    'strokeStyle', 
                    'lineWidth', 
                    'shadowColor', 
                    'shadowOffsetX', 
                    'shadowOffsetY',
                    'shadowBlur',
                    'globalAlpha',
                    'font'];
    var _styleAlias = {          //extend some simplify style name
                         'fill' : 'fillStyle',
                         'stroke' : 'strokeStyle',
                         'alpha' : 'globalAlpha',
                         'shadow' : ['shadowOffsetX', 
                                    'shadowOffsetY', 
                                    'shadowBlur', 
                                    'shadowColor']
                        };

    var shadowSyntaxRegex = /([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+([a-zA-Z0-9\(\)\s,#]+)/;
    
    var Style = Base.derive({}, {

        bind : function(ctx){

            var styles = _styles;
            var styleAlias = _styleAlias;

            for( var alias in styleAlias ){
                if( this.hasOwnProperty(alias) ){
                    var name = styleAlias[alias];
                    var value = this[alias];
                    // composite styles, like shadow, the value can be "0 0 10 #000"
                    if( alias == "shadow" ){
                        var res = shadowSyntaxRegex.exec(trim(value));
                        if( ! res )
                            continue;
                        value = res.slice(1);
                        _.each( value, function(item, idx){
                            if( name[idx] ){
                                ctx[ name[idx] ] = item;
                            }
                        }, this)
                    }else{
                        ctx[ name ] = value;
                    }
                }
            }
            _.each(styles, function(styleName){
                if( this.hasOwnProperty( styleName ) ){
                    ctx[styleName] = this[styleName];
                }   
            }, this)
        }
    })

    function trim(str){
        return (str || '').replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '');
    }

    return Style;
});
/**
 * Node of the scene tree
 * And it is the base class of all elements
 */
define('2d/node',['require','core/base','glmatrix','./style'],function(require){
    
    var Base = require("core/base");
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;
    var mat2d = glmatrix.mat2d;
    var Style = require("./style");

    var Node = Base.derive( function(){
        return {
            //a flag to judge if mouse is over the element
            __mouseover__ : false,
            
            id : 0,
            
            //Axis Aligned Bounding Box
            AABB : [vec2.fromValues(0, 0), vec2.fromValues(0, 0)],
            // z index
            z : 0,
            // GooJS.Style
            style : null,
            
            position : vec2.fromValues(0, 0),
            rotation : 0,
            scale : vec2.fromValues(1, 1),

            _transform : mat2d.create(),
            // inverse matrix of transform matrix
            _transformInverse : mat2d.create(),

            // visible flag
            visible : true,

            children : {},
            // virtual width of the stroke line for intersect
            intersectLineWidth : 0,

            // Clip flag
            // If it is true, this element can be used as a mask
            // and all the children will be clipped in its shape
            //
            // TODO: add an other mask flag to distinguish with the clip?
            clip : false,

            // flag of fill when drawing the element
            fill : true,
            // flag of stroke when drawing the element
            stroke : true,
            // fix aa problem
            // https://developer.mozilla.org/en-US/docs/HTML/Canvas/Tutorial/Applying_styles_and_colors?redirectlocale=en-US&redirectslug=Canvas_tutorial%2FApplying_styles_and_colors#section_8
            fixAA : true
        }
    }, function(){
        
        this.__GUID__ = genGUID();

    }, {
        updateTransform : function(){
            var transform = this._transform;
            mat2d.identity( transform );
            if( this.scale)
                mat2d.scale(transform, transform, this.scale);
            if( this.rotation)
                mat2d.rotate(transform, transform, this.rotation);
            if( this.position)
                mat2d.translate(transform, transform, this.position);
            
            return transform;
        },
        updateTransformInverse : function(){
            mat2d.invert(this._transformInverse, this._transformInverse);
        },
        // intersect with the bounding box
        intersectAABB : function(x, y){
            var AABB = this.AABB;
            return  (AABB[0][0] < x && x < AABB[1][0]) && (AABB[0][1] < y && y< AABB[1][1]);
        },

        add : function(elem){
            if( elem ){
                this.children[elem.__GUID__] = elem;
                elem.parent = this;
            }
        },
        remove : function(elem){
            this.children[elem.__GUID__] = null;
            elem.parent = null;
        },

        draw : function(context){},

        render : function(context){
            
            var renderQueue = this._getSortedRenderQueue();
            context.save();
            if( this.style ){
                if( ! this.style instanceof Style ){
                    for(var name in this.style ){
                        this.style[ name ].bind(context);
                    }
                }else{
                    this.style.bind(context);
                }
            }
            var m = this.updateTransform();
            context.transform( m[0], m[1], m[2], m[3], m[4], m[5]);

            this.draw( context );

            //clip from current path;
            this.clip && context.clip();

            for(var i = 0; i < renderQueue.length; i++){
                renderQueue[i].render( context );
            }
            context.restore();
        },

        traverse : function(callback){
            var stopTraverse = callback && callback( this );
            if( ! stopTraverse ){
                var children = this.children;
                for( var i = 0, len = children.length; i < len; i++){
                    children[i].traverse( callback );
                }
            }
        },

        intersect : function(x, y, eventName){

        },

        _getSortedRenderQueue : function(){
            var renderQueue = [];
            for(var guid in this.children ){
                renderQueue.push( this.children[guid] );
            }
            renderQueue.sort( function(x, y){
                if( x.z === y.z)
                    return x.__GUID__ > y.__GUID__ ? 1 : -1;
                return x.z > y.z ? 1 : -1 ;
            } );
            return renderQueue; 
        }
    })

    var genGUID = (function(){
        var guid = 0;
        
        return function(){
            return ++guid;
        }
    })()

    return Node;
});
/**
 *
 * @export{object}
 */
define('2d/util',['require'], function(require){

    return {
        fixPos: function( pos ){
            return [pos[0]+0.5, pos[1]+0.5];
        },
        fixPosArray : function( poslist ){
            var ret = [];
            var len = poslist.length;
            for(var i = 0; i < len; i++){
                ret.push( this.fixPos(poslist[i]) );
            }
            return ret;
        },
        computeAABB : function( points ){
            var left = points[0][0];
            var right = points[0][0];
            var top = points[0][1];
            var bottom = points[0][1];
            
            for(var i = 1; i < points.length; i++){
                left = points[i][0] < left ? points[i][0] : left;
                right = points[i][0] > right ? points[i][0] : right;
                top = points[i][1] < top ? points[i][1] : top;
                bottom = points[i][1] > bottom ? points[i][1] : bottom;
            }
            return [[left, top], [right, bottom]];
        }
    }
} );
define('2d/renderable/arc',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Arc = Node.derive( function(){
        return {
            center      : [0, 0],
            radius      : 0,
            startAngle  : 0,
            endAngle    : Math.PI*2,
            clockwise   : true
        }
    }, {
        computeAABB : function(){
            // TODO
            this.AABB = [[0, 0], [0, 0]];
        },
        draw : function(contex){

            var center = this.fixAA ? util.fixPos( this.center ) : this.center;

            ctx.beginPath();
            ctx.arc(center[0], center[1], this.radius, this.startAngle, this.endAngle,  ! this.clockwise);
            if(this.stroke){
                ctx.stroke();
            }
            if(this.fill){
                ctx.fill();
            }   
        },
        intersect : function(x, y){
            // TODO
            return false;
        }
    })

    return Arc;
});
define('2d/renderable/circle',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Circle = Node.derive( function() {
        return {
            center : [0, 0],
            radius : 0   
        }

    }, {
        computeAABB : function() {
            this.AABB = [[this.center[0]-this.radius, this.center[1]-this.radius],
                         [this.center[0]+this.radius, this.center[1]+this.radius]];
        },
        draw : function(ctx) {
            var center = this.fixAA ? util.fixPos( this.center ) : this.center;

            ctx.beginPath();
            ctx.arc(center[0], center[1], this.radius, 0, 2*Math.PI, false);
            
            if (this.stroke) {
                ctx.stroke();
            }
            if (this.fill) {
                ctx.fill();
            }
        },
        intersect : function() {

            return vec2.len([this.center[0]-x, this.center[1]-y]) < this.radius;
        }
    } )

    return Circle;
});
define('2d/renderable/image',['require','../node','../util','glmatrix'],function(require) {

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var _imageCache = {};
    
    var Image = Node.derive( function() {
        return {
            img     : '',
            start   : [0, 0],
            size    : 0,
            onload  : function() {}
        }
    }, function() {
        if(typeof this.img == 'string') {
            var self = this;
            
            this.load( this.img, function(img) {
                self.img = img;
                self.onload.call( self );
            })
        }
    }, {
        computeAABB : function() {

            this.AABB = util.computeAABB([this.start, [this.start[0]+this.size[0], this.start[1]+this.size[1]]]);
        },
        draw : function(ctx) {

            var start = this.fixAA ? util.fixPos(this.start) : this.start;

            if(typeof this.img != 'string') {
                this.size ? 
                    ctx.drawImage(this.img, start[0], start[1], this.size[0], this.size[1]) :
                    ctx.drawImage(this.img, start[0], start[1]);
            }

        },
        intersect : function(x, y) {

            return this.intersectAABB(x, y);
        },
        load : function( src, callback ) {

            if( _imageCache[src] ) {
                var img = _imageCache[src];
                if( img.constructor == Array ) {
                    img.push( callback );
                }else{
                    callback(img);
                }
            }else{
                _imageCache[src] = [callback];
                var img = new Image();
                img.onload = function() {
                    each( _imageCache[src], function(cb) {
                        cb( img );
                    })
                    _imageCache[src] = img;
                }
                img.src = src;
            }
        }
    })
    
    return Image;
});
define('2d/renderable/line',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Line = Node.derive(function(){
        return {
            start : [0, 0],
            end : [0, 0],
            width : 0   //virtual width of the line for intersect computation 
        }
    }, {
        computeAABB : function(){

            this.AABB = util.computeAABB([this.start, this.end]);
            
            if(this.AABB[0][0] == this.AABB[1][0]){ //line is vertical
                this.AABB[0][0] -= this.width/2;
                this.AABB[1][0] += this.width/2;
            }
            if(this.AABB[0][1] == this.AABB[1][1]){ //line is horizontal
                this.AABB[0][1] -= this.width/2;
                this.AABB[1][1] += this.width/2;
            }
        },
        draw : function(ctx){
            
            var start = this.fixAA ? util.fixPos(this.start) : this.start,
                end = this.fixAA ? util.fixPos(this.end) : this.end;

            ctx.beginPath();
            ctx.moveTo(start[0], start[1]);
            ctx.lineTo(end[0], end[1]);
            ctx.stroke();

        },
        intersect : function(x, y){
            
            if(!this.intersectAABB(x, y)){
                return false;
            }
            //计算投影点
            var a = [x, y]
                b = this.start,
                c = this.end,
                ba = vec2.sub([], a, b),
                bc = vec2.sub([], c, b);
            
            var dd = vec2.dot(bc, ba);  //ba在bc上的投影长度
            vec2.normalize(bc, bc);
            
            var d = vec2.add(b, vec2.scale(bc, dd));        //投影点   
            var distance = vec2.length(vec2.sub(a, a, d));
            return distance < this.width/2;
        }
    });

    return Line;
});
define('2d/renderable/path',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Path = Node.derive( function(){
        return {
            segments : [],
            globalStyle : true
        }
    }, {
        computeAABB : function(){
            this.AABB = [[0, 0], [0, 0]];
        },
        draw : function(ctx){
            
            if(this.globalStyle){
                this.drawWithSameStyle(ctx);
            }else{
                this.drawWithDifferentStyle(ctx);
            }
        },
        drawWithSameStyle : function(ctx){
            
            var l = this.segments.length;
            var segs = this.segments;

            ctx.beginPath();
            ctx.moveTo(segs[0].point[0], segs[0].point[1]);
            for(var i =1; i < l; i++){

                if(segs[i-1].handleOut || segs[i].handleIn){
                    var prevHandleOut = segs[i-1].handleOut || segs[i-1].point;
                    var handleIn = segs[i].handleIn || segs[i].point;
                    ctx.bezierCurveTo(prevHandleOut[0], prevHandleOut[1],
                            handleIn[0], handleIn[1], segs[i].point[0], segs[i].point[1]);
                }
                else{
                    ctx.lineTo(segs[i].point[0], segs[i].point[1]);
                }

            }
            if(this.fill){
                ctx.fill();
            }
            if(this.stroke){
                ctx.stroke();
            }   
        },
        drawWithDifferentStyle : function(ctx){
            
            var l = this.segments.length;
            var segs = this.segments;

            for(var i =0; i < l-1; i++){

                ctx.save();
                segs[i].style && segs[i].style.bind(ctx);

                ctx.beginPath();
                ctx.moveTo(segs[i].point[0], segs[i].point[1]);

                if(segs[i].handleOut || segs[i+1].handleIn){
                    var handleOut = segs[i].handleOut || segs[i].point;
                    var nextHandleIn = segs[i+1].handleIn || segs[i+1].point;
                    ctx.bezierCurveTo(handleOut[0], handleOut[1],
                            nextHandleIn[0], nextHandleIn[1], segs[i+1].point[0], segs[i+1].point[1]);
                }
                else{
                    ctx.lineTo(segs[i+1].point[0], segs[i+1].point[1]);
                }

                if(this.stroke){
                    ctx.stroke();
                }
                if(this.fill){
                    ctx.fill();
                }
                ctx.restore();
            }
        },
        smooth : function(degree){
            var len = this.segments.length;
            var middlePoints = [];
            var segs = this.segments;

            function computeVector(a, b, c){
                var m = vec2.scale([], vec2.add([], b, c), 0.5);
                return vec2.sub([], a, m);
            }

            for(var i = 0; i < len; i++){
                var point = segs[i].point;
                var nextPoint = (i == len-1) ? segs[0].point : segs[i+1].point;
                middlePoints.push(
                        vec2.scale([], vec2.add([], point, nextPoint), 0.5));
            }

            for(var i = 0; i < len; i++){
                var point = segs[i].point;
                var middlePoint = middlePoints[i];
                var prevMiddlePoint = (i == 0) ? middlePoints[len-1] : middlePoints[i-1];
                var degree = segs[i].smoothLevel || degree || 1;
                var middleMiddlePoint = vec2.scale([], vec2.add([], middlePoint, prevMiddlePoint), 0.5);
                var v1 = vec2.sub([], middlePoint, middleMiddlePoint);
                var v2 = vec2.sub([], prevMiddlePoint, middleMiddlePoint);

                var dv = computeVector(point, prevMiddlePoint, middlePoint);
                //use degree to scale the handle length
                vec2.scale(v2, v2, degree);
                vec2.scale(v1, v1, degree);
                segs[i].handleIn = vec2.add([], vec2.add([], middleMiddlePoint, v2), dv);
                segs[i].handleOut = vec2.add([], vec2.add([], middleMiddlePoint, v1), dv);
            }
            segs[0].handleOut = segs[0].handleIn = null;
            segs[len-1].handleIn = segs[len-1].handleOut = null;
            
        },
        pushPoints : function(points){
            for(var i = 0; i < points.length; i++){
                this.segments.push({
                    point : points[i],
                    handleIn : null,
                    handleOut : null
                })
            }
        }
    })

    return Path;
});
define('2d/renderable/polygon',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Polygon = Node.derive( function(){
        return {
            points : []
        }
    }, {
        computeAABB : function(){
            this.AABB = util.computeAABB( this.points );
        },
        draw : function(ctx){

            var points = this.fixAA ? util.fixPosArray(this.points) : this.points;

            ctx.beginPath();
            
            ctx.moveTo(points[0][0], points[0][1]);
            for(var i =1; i < points.length; i++){
                ctx.lineTo(points[i][0], points[i][1]);
            }
            ctx.closePath();
            if(this.stroke){
                ctx.stroke();
            }
            if(this.fill){
                ctx.fill();
            }
        },
        intersect : function(x, y){
    
            if(!this.intersectAABB(x, y)){
                return false;
            }

            var len = this.points.length;
            var angle = 0;
            var points = this.points;
            var vec1, vec2, j, piece;
            for(var i =0; i < len; i++){
                vec1 = vec2.normalize([], [points[i][0]-x, points[i][1]-y]);
                j = (i+1)%len;
                vec2 =  vec2.normalize([], [points[j][0]-x, points[j][1]-y]);
                piece = Math.acos(vec2.dot(vec1, vec2));
                angle += piece;
            }
            return Math.length(angle - 2*Math.PI) < 0.001;
        }
    })

    return Node;
});
define('2d/renderable/rectangle',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node'),
        util = require('../util'),
        glmatrix = require('glmatrix'),
        vec2 = glmatrix.vec2;

    var Rectangle = Node.derive( function(){
        return {
            start : [0, 0],
            size : [0, 0]
        }
    }, {
        computeAABB : function(){
            var end = vec2.add([], this.start, this.size);
            this.AABB = util.computeAABB([this.start, end]);
        },
        draw : function(ctx){

            var start = this.fixAA ? util.fixPos(this.start) : this.start;

            ctx.beginPath();
            ctx.rect(start[0], start[1], this.size[0], this.size[1]);
            if(this.stroke){
                ctx.stroke();
            }
            if(this.fill){
                ctx.fill();
            }
        },
        intersect : function(x, y){
            
            return this.intersectAABB(x, y);
        }
    })

    return Rectangle;
});
/**
 * @export{class} RoundedRectangle
 */
define('2d/renderable/roundedrectangle',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var RoundedRectange = Node.derive( function(){
        return {
            start   : [0, 0],
            size    : [0, 0],
            radius  : 0
        }
    }, {
        computeAABB : function(){
            var end = vec2.add([], this.start, this.size);
            this.AABB = util.computeAABB([this.start, end]);
        },
        draw : function(ctx){

            if( this.radius.constructor == Number){
                // topleft, topright, bottomright, bottomleft
                var radius = [this.radius, this.radius, this.radius, this.radius];
            }else if( this.radius.length == 2){
                var radius = [this.radius[0], this.radius[1], this.radius[0], this.radius[1]];
            }else{
                var radius = this.radius;
            }

            var start = this.fixAA ? util.fixPos(this.start) : this.start;
            var size = this.size;
            var v1 = vec2.add([], start, [radius[0], 0]);   //left top
            var v2 = vec2.add([], start, [size[0], 0]);     //right top
            var v3 = vec2.add([], start, size);             //right bottom
            var v4 = vec2.add([], start, [0, size[1]]);     //left bottom
            ctx.beginPath();
            ctx.moveTo( v1[0], v1[1] );
            radius[1] ? 
                ctx.arcTo( v2[0], v2[1], v3[0], v3[1], radius[1]) :
                ctx.lineTo( v2[0], v2[1] );
            radius[2] ?
                ctx.arcTo( v3[0], v3[1], v4[0], v4[1], radius[2]) :
                ctx.lineTo( v3[0], v3[1] );
            radius[3] ?
                ctx.arcTo( v4[0], v4[1], start[0], start[1], radius[3]) :
                ctx.lineTo( v4[0], v4[1] );
            radius[0] ? 
                ctx.arcTo( start[0], start[1], v2[0], v2[1], radius[0]) :
                ctx.lineTo( start[0], start[1]);
            
            if( this.stroke ){
                ctx.stroke();
            }
            if( this.fill ){
                ctx.fill();
            }
        },
        intersect : function(x, y){
            // TODO
            return false;
        }
    })

    return RoundedRectange;
});
define('2d/renderable/sector',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Sector = Node.derive( function(){
        return {
            center      : [0, 0],
            innerRadius : 0,
            outerRadius : 0,
            startAngle  : 0,
            endAngle    : 0,
            clockwise   : true
        }
    }, {
        computeAABB : function(){
            // TODO
            this.AABB = [0, 0];
        },
        intersect : function(x, y){

            var startAngle = this.startAngle;
            var endAngle = this.endAngle;
            var r1 = this.innerRadius;
            var r2 = this.outerRadius;
            var c = this.center;
            var v = vec2.sub([], [x, y], c);
            var r = vec2.length(v);
            var pi2 = Math.PI * 2;

            if(r < r1 || r > r2){
                return false;
            }
            var angle = Math.atan2(v[1], v[0]);

            //need to constraint the angle between 0 - 360
            if(angle < 0){
                angle = angle+pi2;
            }
            
            if(this.clockwise){
                
                return angle < endAngle && angle > startAngle;
            }else{
                startAngle =  pi2 - startAngle;
                endAngle = pi2 - endAngle;
                return angle > endAngle && angle < startAngle;
            }   
        },
        draw : function(ctx){

            var startAngle = this.startAngle;
            var endAngle = this.endAngle;
            var r1 = this.innerRadius;
            var r2 = this.outerRadius;
            var c = this.fixAA ? util.fixPos( this.center ) : this.center;

            if( ! this.clockwise ){
                startAngle =  Math.PI*2 - startAngle;
                endAngle =  Math.PI*2 - endAngle;
            }

            var startInner = vec2.add([], c, [r1 * Math.cos(startAngle), r1 * Math.sin(startAngle)]);
            var startOuter = vec2.add([], c, [r2 * Math.cos(startAngle), r2 * Math.sin(startAngle)]);
            var endInner = vec2.add([], c, [r1 * Math.cos(endAngle), r1 * Math.sin(endAngle)]);
            var endOuter = vec2.add([], c, [r2 * Math.cos(endAngle), r2 * Math.sin(endAngle)]);

            ctx.beginPath();
            ctx.moveTo(startInner[0], startInner[1]);
            ctx.lineTo(startOuter[0], startOuter[1]);
            ctx.arc(c[0], c[1], r2, startAngle, endAngle, ! this.clockwise);
            ctx.lineTo(endInner[0], endInner[1]);
            ctx.arc(c[0], c[1], r1, endAngle, startAngle, this.clockwise);
            ctx.endPath();

            if(this.stroke){
                ctx.stroke();
            }
            if(this.fill){
                ctx.fill();
            }
        }
    })

    return Sector;
});
define('2d/renderable/text',['require','../node','../util','glmatrix'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;

    var Text = Node.derive( function(){
        return {
            text : '',
            start : [0, 0],
            size : [0, 0],
            font : '',
            textAlign : '',
            textBaseline : ''
        }
    }, {
        computeAABB : function(){
            this.AABB = util.computeAABB( [this.start, [this.start[0]+this.size[0], this.start[1]+this.size[1]]] );
        },
        draw : function(ctx){
            var start = this.fixAA ? util.fixPos(this.start) : this.start;
            if(this.font){
                ctx.font = this.font;
            }
            if(this.textAlign){
                ctx.textAlign = this.textAlign;
            }
            if(this.textBaseline){
                ctx.textBaseline = this.textBaseline
            }
            if(this.fill){
                this.size.length && this.size[0] ?
                    ctx.fillText(this.text, start[0], start[1], this.size[0]) :
                    ctx.fillText(this.text, start[0], start[1]);
            }
            if(this.stroke){
                this.size.length && this.size[0] ?
                    ctx.strokeText(this.text, start[0], start[1], this.size[0]) :
                    ctx.strokeText(this.text, start[0], start[1]);
            }
        },
        resize : function(ctx){
            if(! this.size[0] || this.needResize){
                this.size[0] = ctx.measureText(this.text).width;
                this.size[1] = ctx.measureText('m').width;
            }
        },
        intersect : function(x, y){
            return this.intersectAABB(x, y);
        }
    })

    return Text;
});
/**
 * Text Box
 * Support word wrap and word break
 * Drawing is based on the Text
 * @export{class} TextBox
 *
 * TODO: support word wrap of non-english text
 *      shift first line by (lineHeight-fontSize)/2
 */
define('2d/renderable/textbox',['require','../node','../util','glmatrix','./text','_'],function(require){

    var Node = require('../node');
    var util = require('../util');
    var glmatrix = require('glmatrix');
    var vec2 = glmatrix.vec2;
    var Text = require('./text');
    var _ = require('_');

    var TextBox = Node.derive( function(){
        return {
            text            : '',
            textAlign       : '',
            textBaseline    : 'top',
            font            : '',

            start           : [0, 0],
            width           : 0,
            wordWrap        : false,
            wordBreak       : false,
            lineHeight      : 0,
            stroke          : false,
            // private prop, save Text instances
            _texts          : []
        }
    }, function(){
        // to verify if the text is changed
        this._oldText = "";
    }, {
        computeAABB : function(){
            // TODO
        },
        draw : function(ctx){
            if( this.text != this._oldText){
                this._oldText = this.text;

                //set font for measureText
                if( this.font ){
                    ctx.font = this.font;
                }
                if( this.wordBreak){
                    this._texts = this.computeWordBreak( ctx );
                }
                else if(this.wordWrap){
                    this._texts = this.computeWordWrap( ctx );
                }
                else{
                    var txt = new Text({
                        text : this.text,
                        textBaseline : this.textBaseline
                    })
                    this.extendCommonProperties(txt);
                    this._texts = [txt]
                }
            }
            _.each(this._texts, function(_text){
                _text.draw(ctx);
            })
        },
        computeWordWrap : function( ctx ){
            if( ! this.text){
                return;
            }
            var words = this.text.split(' ');
            var len = words.length;
            var lineWidth = 0;
            var wordWidth;
            var wordText;
            var texts = [];
            var txt;

            for( var i = 0; i < len; i++){
                wordText = i == len-1 ? words[i] : words[i]+' ';
                wordWidth = ctx.measureText( wordText ).width;
                if( lineWidth + wordWidth > this.width ||
                    ! txt ){    //first line
                    // create a new text line and put current word
                    // in the head of new line
                    txt = new Text({
                        text : wordText, //append last word
                        start : vec2.add([], this.start, [0, this.lineHeight*texts.length])
                    })
                    this.extendCommonProperties(txt);
                    texts.push( txt );

                    lineWidth = wordWidth;
                }else{
                    lineWidth += wordWidth;
                    txt.text += wordText;
                }
            }
            return texts;
        },
        computeWordBreak : function( ctx ){
            if( ! this.text){
                return;
            }
            var len = this.text.length;
            var letterWidth;
            var letter;
            var lineWidth = ctx.measureText(this.text[0]).width;
            var texts = [];
            var txt;
            for(var i = 0; i < len; i++){
                letter = this.text[i];
                letterWidth = ctx.measureText( letter ).width;
                if( lineWidth + letterWidth > this.width || 
                    ! txt ){    //first line
                    var txt = new Text({
                        text : letter,
                        start : vec2.add([], this.start, [0, this.lineHeight*texts.length])
                    });
                    this.extendCommonProperties(txt);
                    texts.push(txt);
                    // clear prev line states
                    lineWidth = letterWidth;
                }else{
                    lineWidth += letterWidth;
                    txt.text += letter;
                }
            }
            return texts;
        },
        extendCommonProperties : function(txt){
            var props = {};
            _.extend(txt, {
                textAlign : this.textAlign,
                textBaseline : this.textBaseline,
                style : this.style,
                font : this.font,
                fill : this.fill,
                stroke : this.stroke
            })
        },
        intersect : function(x, y){
            
        }
    } )

    return TextBox;
});
define('2d/renderer',['require','core/base'], function(require){

    var Base = require('core/base');

    var Renderer = Base.derive(function(){
        return {
            canvas : null,

            context : null,

            width : 0,

            height : 0,

            _latestRenderedScene : null
        }
    }, function(){
        
        if( ! this.canvas ){
            this.canvas = document.createElement('canvas');
        }

        this.canvas.addEventListener('click', this._clickHandler.bind(this));
        this.canvas.addEventListener('mousedown', this._mouseDownHandler.bind(this));
        this.canvas.addEventListener('mouseup', this._mouseUpHandler.bind(this));
        this.canvas.addEventListener('mousemove', this._mouseMoveHandler.bind(this));
        this.canvas.addEventListener('mouseout', this._mouseOutHandler.bind(this));
        
        if( this.width ){
            this.canvas.width = this.width;
        }else{
            this.width = this.canvas.width;
        }
        if( this.height ){
            this.canvas.height = this.height;
        }else{
            this.height = this.canvas.height;
        }
        this.context = this.canvas.getContext('2d');

    }, {

        resize : function(width, height){
            this.canvas.width = width;
            this.canvas.height = height
        },

        render : function( scene ){
            this.context.clearRect(0, 0, this.width, this.height);

            scene.render( this.context );

            this._latestRenderedScene = scene;
        },

        _clickHandler : function(){
            var scene = this._latestRenderedScene;
        },

        _mouseDownHandler : function(){

        },

        _mouseUpHandler : function(){

        },

        _mouseMoveHandler : function(){

        },

        _mouseOutHandler : function(){

        }
    })

    return Renderer;
} );
define('2d/scene',['require','./node'], function(require){

    var Node = require('./node');

    var Scene = Node.derive(function(){
        return {}
    },{

    });

    return Scene;
} );
define('core/vector3',['require','glmatrix'], function(require){

    var glMatrix = require("glmatrix");
    var vec3 = glMatrix.vec3;

    var Vector3 = function(x, y, z){
        
        x = x || 0;
        y = y || 0;
        z = z || 0;
        
        return Object.create(Vector3Proto, {

            x : {
                configurable : false,
                set : function(value){
                    this._array[0] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[0];
                }
            },
            y : {
                configurable : false,
                set : function(value){
                    this._array[1] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[1];
                }
            },
            z : {
                configurable : false,
                set : function(value){
                    this._array[2] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[2];
                }
            },

            _array :{
                writable : false,
                configurable : false,
                value : vec3.fromValues(x, y, z)
            },
            // Dirty flag is used by the Node to determine
            // if the matrix is updated to latest
            _dirty : {
                configurable : false,
                value : true
            }
        })

    }

    var Vector3Proto = {

        constructor : Vector3,

        add : function(b){
            vec3.add( this._array, this._array, b._array );
            this._dirty = true;
            return this;
        },

        set : function(x, y, z){
            this._array[0] = x;
            this._array[1] = y;
            this._array[2] = z;
            this._dirty = true;
            return this;
        },

        clone : function(){
            return new Vector3( this.x, this.y, this.z );
        },

        copy : function(b){
            vec3.copy( this._array, b._array );
            this._dirty = true;
            return this;
        },

        cross : function(out, b){
            vec3.cross(out._array, this._array, b._array);
            return this;
        },

        dist : function(b){
            return vec3.dist(this._array, b._array);
        },

        distance : function(b){
            return vec3.distance(this._array, b._array);
        },

        div : function(b){
            vec3.div(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        divide : function(b){
            vec3.divide(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        dot : function(b){
            return vec3.dot(this._array, b._array);
        },

        len : function(){
            return vec3.len(this._array);
        },

        length : function(){
            return vec3.length(this._array);
        },
        /**
         * Perform linear interpolation between a and b
         */
        lerp : function(a, b, t){
            vec3.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        mul : function(b){
            vec3.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        multiply : function(b){
            vec3.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        negate : function(){
            vec3.negate(this._array, this._array);
            this._dirty = true;
            return this;
        },

        normalize : function(){
            vec3.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },

        random : function(scale){
            vec3.random(this._array, scale);
            this._dirty = true;
            return this;
        },

        scale : function(s){
            vec3.scale(this._array, this._array, s);
            this._dirty = true;
            return this;
        },
        /**
         * add b by a scaled factor
         */
        scaleAndAdd : function(b, s){
            vec3.scaleAndAdd(this._array, this._array, b._array, s);
            this._dirty = true;
            return this;
        },

        sqrDist : function(b){
            return vec3.sqrDist(this._array, b._array);
        },

        squaredDistance : function(b){
            return vec3.squaredDistance(this._array, b._array);
        },

        sqrLen : function(){
            return vec3.sqrLen(this._array);
        },

        squaredLength : function(){
            return vec3.squaredLength(this._array);
        },

        sub : function(b){
            vec3.sub(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        subtract : function(b){
            vec3.subtract(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        transformMat3 : function(m){
            vec3.transformMat3(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },

        transformMat4 : function(m){
            vec3.transformMat4(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },

        transformQuat : function(q){
            vec3.transformQuat(this._array, this._array, q._array);
            this._dirty = true;
            return this;
        },     
        /**
         * Set euler angle from queternion
         */
        setEulerFromQuaternion : function(q){
            // var sqx = q.x * q.x;
            // var sqy = q.y * q.y;
            // var sqz = q.z * q.z;
            // var sqw = q.w * q.w;
            // this.x = Math.atan2( 2 * ( q.y * q.z + q.x * q.w ), ( -sqx - sqy + sqz + sqw ) );
            // this.y = Math.asin( -2 * ( q.x * q.z - q.y * q.w ) );
            // this.z = Math.atan2( 2 * ( q.x * q.y + q.z * q.w ), ( sqx - sqy - sqz + sqw ) );

            // return this;
        },

        toString : function(){
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        },
    }


    function clamp( x ) {
        return Math.min( Math.max( x, -1 ), 1 );
    }

    return Vector3;

} );
define('core/quaternion',['require','glmatrix'], function(require){

    var glMatrix = require("glmatrix");
    var quat = glMatrix.quat;

    var Quaternion = function(x, y, z, w){

        x = x || 0;
        y = y || 0;
        z = z || 0;
        w = typeof(w) === "undefined" ? 1 : w;
                
        return Object.create(QuaternionProto, {

            x : {
                configurable : false,
                set : function(value){
                    this._array[0] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[0];
                }
            },
            y : {
                configurable : false,
                set : function(value){
                    this._array[1] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[1];
                }
            },
            z : {
                configurable : false,
                set : function(value){
                    this._array[2] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[2];
                }
            },
            w : {
                configurable : false,
                set : function(value){
                    this._array[2] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[2];
                }
            },

            _array :{
                writable : false,
                configurable : false,
                value : quat.fromValues(x, y, z, w)
            },
            _dirty : {
                configurable : false,
                value : false
            }
        })

    }

    var QuaternionProto = {

        constructor : Quaternion,

        add : function(b){
            quat.add( this._array, this._array, b._array );
            this._dirty = true;
            return this;
        },

        calculateW : function(){
            quat.calculateW(this._array, this._array);
            this._dirty = true;
            return this;
        },

        set : function(x, y, z, w){
            this._array[0] = x;
            this._array[1] = y;
            this._array[2] = z;
            this._array[3] = w;
            this._dirty = true;
            return this;
        },

        clone : function(){
            return new Quaternion( this.x, this.y, this.z, this.w );
        },

        /**
         * Calculates the conjugate of a quat If the quaternion is normalized, 
         * this function is faster than quat.inverse and produces the same result.
         */
        conjugate : function(){
            quat.conjugate(this._array, this._array);
            this._dirty = true;
            return this;
        },

        copy : function(b){
            quat.copy( this._array, b._array );
            this._dirty = true;
            return this;
        },

        dot : function(b){
            return quat.dot(this._array, b._array);
        },

        fromMat3 : function(m){
            quat.fromMat3(this._array, m._array);
            this._dirty = true;
            return this;
        },

        fromMat4 : (function(){
            var mat3 = glMatrix.mat3;
            var m3 = mat3.create();
            return function(m){
                mat3.fromMat4(m3, m._array);
                // Not like mat4, mat3 in glmatrix seems to be row-based
                mat3.transpose(m3, m3);
                quat.fromMat3(this._array, m3);
                this._dirty = true;
                return this;
            }
        })(),

        identity : function(){
            quat.identity(this._array);
            this._dirty = true;
            return this;
        },

        invert : function(){
            quat.invert(this._array, this._array);
            this._dirty = true;
            return this;
        },

        len : function(){
            return quat.len(this._array);
        },

        length : function(){
            return quat.length(this._array);
        },

        /**
         * Perform linear interpolation between a and b
         */
        lerp : function(a, b, t){
            quat.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        mul : function(b){
            quat.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        multiply : function(b){
            quat.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        normalize : function(){
            quat.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },

        rotateX : function(rad){
            quat.rotateX(this._array, this._array, rad); 
            this._dirty = true;
            return this;
        },

        rotateY : function(rad){
            quat.rotateY(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },

        rotateZ : function(rad){
            quat.rotateZ(this._array, this._array, rad);
            this._dirty = true;
            return this;
        },

        setAxisAngle : function(axis /*Vector3*/, rad){
            quat.setAxisAngle(this._array, axis._array, rad);
            this._dirty = true;
            return this;
        },

        slerp : function(a, b, t){
            quat.slerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        sqrLen : function(){
            return quat.sqrLen(this._array);
        },

        squaredLength : function(){
            return quat.squaredLength(this._array);
        },
        /**
         * Set quaternion from euler angle
         */
        setFromEuler : function(v){
            
        },

        toString : function(){
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    return Quaternion;
} );
define('core/matrix4',['require','glmatrix','./vector3'], function(require){

    var glMatrix = require("glmatrix");
    var Vector3 = require("./vector3");
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;
    var mat3 = glMatrix.mat3;
    var quat = glMatrix.quat;

    function makeProperty(n){
        return {
            configurable : false,
            set : function(value){
                this._array[n] = value;
                this._dirty = true;
            },
            get : function(){
                return this._array[n];
            }
        }
    }
    var Matrix4 = function(){

        var axisX = new Vector3(),
            axisY = new Vector3(),
            axisZ = new Vector3();

        return Object.create(Matrix4Proto, {

            m00 : makeProperty(0),
            m01 : makeProperty(1),
            m02 : makeProperty(2),
            m03 : makeProperty(3),
            m10 : makeProperty(4),
            m11 : makeProperty(5),
            m12 : makeProperty(6),
            m13 : makeProperty(7),
            m20 : makeProperty(8),
            m21 : makeProperty(9),
            m22 : makeProperty(10),
            m23 : makeProperty(11),
            m30 : makeProperty(12),
            m31 : makeProperty(13),
            m32 : makeProperty(14),
            m33 : makeProperty(15),

            // Forward axis of local matrix, i.e. z axis
            forward : {
                configurable : false,
                get : function(){
                    var el = this._array;
                    axisZ.set(el[8], el[9], el[10]);
                    return axisZ;
                },
                // TODO Here has a problem
                // If only set an item of vector will not work
                set : function(v){
                    var el = this._array,
                        v = v._array;
                    el[8] = v[8];
                    el[9] = v[9];
                    el[10] = v[10];
                }
            },

            // Up axis of local matrix, i.e. y axis
            up : {
                configurable : false,
                enumerable : true,
                get : function(){
                    var el = this._array;
                    axisY.set(el[4], el[5], el[6]);
                    return axisY;
                },
                set : function(v){
                    var el = this._array,
                        v = v._array;
                    el[4] = v[4];
                    el[5] = v[5];
                    el[6] = v[6];
                }
            },

            // Right axis of local matrix, i.e. x axis
            right : {
                configurable : false,
                get : function(){
                    var el = this._array;
                    axisX.set(el[0], el[1], el[2]);
                    return axisX;
                },
                set : function(v){
                    var el = this._array,
                        v = v._array;
                    el[0] = v[0];
                    el[1] = v[1];
                    el[2] = v[2];
                }
            },
            
            _array : {
                writable : false,
                configurable : false,
                value : mat4.create()
            }
        })
    };

    var Matrix4Proto = {

        constructor : Matrix4,

        adjoint : function(){
            mat4.adjoint(this._array, this._array);
            return this;
        },
        clone : function(){
            return (new Matrix4()).copy(this);
        },
        copy : function(b){
            mat4.copy(this._array, b._array);
            return this;
        },
        determinant : function(){
            return mat4.determinant(this._array);
        },
        fromQuat : function(q){
            mat4.fromQuat(this._array, q._array);
            return this;
        },
        fromRotationTranslation : function(q, v){
            mat4.fromRotationTranslation(this._array, q._array, v._array);
            return this;
        },
        frustum : function(left, right, bottom, top, near, far){
            mat4.frustum(this._array, left, right, bottom, top, near, far);
            return this;
        },
        identity : function(){
            mat4.identity(this._array);
            return this;
        },
        invert : function(){
            mat4.invert(this._array, this._array);
            return this;
        },
        lookAt : function(eye, center, up){
            mat4.lookAt(this._array, eye._array, center._array, up._array);
            return this;
        },
        mul : function(b){
            mat4.mul(this._array, this._array, b._array);
            return this;
        },
        mulLeft : function(b){
            mat4.mul(this._array, b._array, this._array);
            return this;
        },
        multiply : function(b){
            mat4.multiply(this._array, this._array, b._array);
            return this;
        },
        // Apply left multiply
        multiplyLeft : function(b){
            mat4.multiply(this._array, b._array, this._array);
            return this;
        },
        ortho : function(left, right, bottom, top, near, far){
            mat4.ortho(this._array, left, right, bottom, top, near, far);
            return this;
        },
        perspective : function(fovy, aspect, near, far){
            mat4.perspective(this._array, fovy, aspect, near, far);
            return this;
        },
        rotate : function(rad, axis /*Vector3*/){
            mat4.rotate(this._array, this._array, rad, axis._array);
            return this;
        },
        rotateX : function(rad){
            mat4.rotateX(this._array, this._array, rad);
            return this;
        },
        rotateY : function(rad){
            mat4.rotateY(this._array, this._array, rad);
            return this;
        },
        rotateZ : function(rad){
            mat4.rotateZ(this._array, this._array, rad);
            return this;
        },
        scale : function(v){
            mat4.scale(this._array, this._array, v._array);
            return this;
        },
        translate : function(v){
            mat4.translate(this._array, this._array, v._array);
            return this;
        },
        transpose : function(){
            mat4.transpose(this._array, this._array);
            return this;
        },

        rotateAround : function(point, axis, angle){
            console.warn("TODO");
        },

        // Static method
        // Decompose a matrix to SRT
        // http://msdn.microsoft.com/en-us/library/microsoft.xna.framework.matrix.decompose.aspx
        decomposeMatrix : (function(){

            var x = vec3.create();
            var y = vec3.create();
            var z = vec3.create();

            var m3 = mat3.create();
            
            return function( scale, rotation, position ){

                var el = this._array;
                vec3.set(x, el[0], el[1], el[2]);
                vec3.set(y, el[4], el[5], el[6]);
                vec3.set(z, el[8], el[9], el[10]);

                scale.x = vec3.length(x);
                scale.y = vec3.length(y);
                scale.z = vec3.length(z);

                position.set(el[12], el[13], el[14]);

                mat3.fromMat4(m3, el);
                // Not like mat4, mat3 in glmatrix seems to be row-based
                mat3.transpose(m3, m3);

                m3[0] /= scale.x;
                m3[1] /= scale.x;
                m3[2] /= scale.x;

                m3[3] /= scale.y;
                m3[4] /= scale.y;
                m3[5] /= scale.y;

                m3[6] /= scale.z;
                m3[7] /= scale.z;
                m3[8] /= scale.z;

                quat.fromMat3(rotation._array, m3);
                rotation.normalize();
            }
        })(),

        toString : function(){
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    return Matrix4;
});
define('core/matrix3',['require','glmatrix'], function(require){

    var glMatrix = require("glmatrix");
    var mat3 = glMatrix.mat3;

    function makeProperty(n){
        return {
            configurable : false,
            set : function(value){
                this._array[n] = value;
                this._dirty = true;
            },
            get : function(){
                return this._array[n];
            }
        }
    }

    var Matrix3 = function(){

        return Object.create(Matrix3Proto, {

            m00 : makeProperty(0),
            m01 : makeProperty(1),
            m02 : makeProperty(2),
            m10 : makeProperty(3),
            m11 : makeProperty(4),
            m12 : makeProperty(5),
            m20 : makeProperty(6),
            m21 : makeProperty(7),
            m22 : makeProperty(8),
            
            _array : {
                writable : false,
                configurable : false,
                value : mat3.create()
            }
        })
    };

    var Matrix3Proto = {

        constructor : Matrix3,

        adjoint : function(){
            mat3.adjoint(this._array, this._array);
            return this;
        },
        clone : function(){
            return (new Matrix3()).copy(this);
        },
        copy : function(b){
            mat3.copy(this._array, b._array);
            return this;
        },
        determinant : function(){
            return mat3.determinant(this._array);
        },
        fromMat2d : function(a){
            return mat3.fromMat2d(this._array, a._array);
        },
        fromMat4 : function(a){
            return mat3.fromMat4(this._array, a._array);
        },
        fromQuat : function(q){
            mat3.fromQuat(this._array, q._array);
            return this;
        },
        identity : function(){
            mat3.identity(this._array);
            return this;
        },
        invert : function(){
            mat3.invert(this._array, this._array);
            return this;
        },
        mul : function(b){
            mat3.mul(this._array, this._array, b._array);
            return this;
        },
        mulLeft : function(b){
            mat3.mul(this._array, b._array, this._array);
            return this;
        },
        multiply : function(b){
            mat3.multiply(this._array, this._array, b._array);
            return this;
        },
        multiplyLeft : function(b){
            mat3.multiply(this._array, b._array, this._array);
            return this;
        },
        /**
         * Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix
         */
        normalFromMat4 : function(a){
            mat3.normalFromMat4(this._array, a._array);
            return a;
        },
        transpose : function(){
            mat3.transpose(this._array, this._array);
            return this;
        },
        toString : function(){
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    return Matrix3;
});
define('util/util',['require'], function(require){

	return {

		genGUID : (function(){
			var guid = 0;
			
			return function(){
				return ++guid;
			}
		})()
	}
} );
define('3d/node',['require','core/base','core/vector3','core/quaternion','core/matrix4','core/matrix3','util/util','_'], function(require){
    
    var Base = require("core/base");
    var Vector3 = require("core/vector3");
    var Quaternion = require("core/quaternion");
    var Matrix4 = require("core/matrix4");
    var Matrix3 = require("core/matrix3");
    var util = require("util/util");
    var _ = require("_");

    var Node = Base.derive( function(){

        var id = util.genGUID();

        return {
            
            __GUID__ : id,

            name : 'NODE_' + id,

            visible : true,

            position : new Vector3(),

            rotation : new Quaternion(),

            scale : new Vector3(1, 1, 1),

            // Euler angles
            // https://en.wikipedia.org/wiki/Rotation_matrix
            eulerAngle : new Vector3(),
            useEuler : false,

            children : [],

            parent : null,

            worldMatrix : new Matrix4(),
            matrix : new Matrix4(),

        }
    }, {

        add : function( node ){
            if( this.children.indexOf( node ) >= 0 ){
                return;
            }
            this.children.push( node );
            node.parent = this;
        },

        remove : function( node ){
            _.without( this.children, node );
            node.parent = null;
        },

        traverse : function( callback ){
            var stopTraverse = callback && callback( this );
            if( ! stopTraverse ){
                var children = this.children;
                for( var i = 0, len = children.length; i < len; i++){
                    children[i].traverse( callback );
                }
            }
        },

        updateMatrix : function(){
            // TODO 
            // use defineSetter to set dirty when the position, rotation, scale is changed ??
            if( ! this.position._dirty &&
                ! this.scale._dirty){
                if( this.useEuler && ! this.eulerAngle._dirty){
                    return;
                }else if( ! this.rotation._dirty){
                    return;
                }
            }

            var m = this.matrix;

            m.identity();

            if( this.useEuler ){
                this.rotation.identity();
                this.rotation.rotateX( this.eulerAngle.x );
                this.rotation.rotateY( this.eulerAngle.y );
                this.rotation.rotateZ( this.eulerAngle.z );
            }
            // Transform order, scale->rotation->position
            m.fromRotationTranslation(this.rotation, this.position);

            m.scale(this.scale);

            this.rotation._dirty = false;
            this.scale._dirty = false;
            this.position._dirty = false;
            this.eulerAngle._dirty = false;
        },

        decomposeMatrix : function(){
            this.matrix.decomposeMatrix( this.scale, this.rotation, this.position );
            if( ! this.useEuler){
                this.eulerAngle.setEulerFromQuaternion(this.rotation);
            }
            
            this.rotation._dirty = false;
            this.scale._dirty = false;
            this.position._dirty = false;
            this.eulerAngle._dirty = false;
        },

        updateWorldMatrix : function(  ){

            this.updateMatrix();
            if( this.parent ){
                this.worldMatrix.copy(this.parent.worldMatrix).multiply(this.matrix);
            }else{
                this.worldMatrix.copy(this.matrix);
            }
        },
        
        // Update the node status in each frame
        update : function( _gl, silent ){

            if( ! silent){
                this.trigger( 'beforeupdate', _gl );
            }
            this.updateWorldMatrix();
            if( ! silent){
                this.trigger( 'afterupdate', _gl);
            }
            
            for(var i = 0; i < this.children.length; i++){
                var child = this.children[i];
                // Skip the hidden nodes
                if( child.visible ){
                    child.update( _gl );
                }
            }
        },

        getWorldPosition : function(){
            
            var m = this.worldMatrix._array;

            return new Vector3(m[12], m[13], m[14]);
        },

        translate : function(v){
            this.updateMatrix();
            this.translate(v);
            this.decomposeMatrix();
        },

        rotate : function(angle, axis){
            this.updateMatrix();
            this.matrix.rotate(angle, axis);
            this.decomposeMatrix();
        },
        // http://docs.unity3d.com/Documentation/ScriptReference/Transform.RotateAround.html
        rotateAround : (function(){
            
            var v = new Vector3();
            var RTMatrix = new Matrix4();

            return function(point, axis, angle){

                v.copy(this.position).subtract(point);

                this.matrix.identity();
                // parent joint
                this.matrix.translate(point);
                this.matrix.rotate(angle, axis);

                // Transform self
                if( this.useEuler ){
                    this.rotation.identity();
                    this.rotation.rotateX( this.eulerAngle.x );
                    this.rotation.rotateY( this.eulerAngle.y );
                    this.rotation.rotateZ( this.eulerAngle.z );
                }
                RTMatrix.fromRotationTranslation(this.rotation, v);
                this.matrix.multiply(RTMatrix);
                this.matrix.scale(this.scale);

                this.decomposeMatrix();
            }
        })(),

        lookAt : (function(){
            var m = new Matrix4();
            var scaleVector = new Vector3();
            return function( target, up ){
                m.lookAt(this.position, target, up || this.matrix.up ).invert();

                m.decomposeMatrix(scaleVector, this.rotation, this.position);

            }
        })(),

    });


    return Node;
});
define('3d/bone',['require','./node','core/quaternion','core/vector3','core/matrix4'],function(require){

    var Node = require("./node");
    var Quaternion = require("core/quaternion");
    var Vector3 = require("core/vector3");
    var Matrix4 = require("core/matrix4");
    
    var Bone = Node.derive(function(){
        return {
            // Index of bone
            index : -1,
            // Parent bone index
            parentIndex : -1,
            //{
            //  time : 
            //  position : 
            //  rotation :
            //  scale
            //}
            poses : []
        }
    }, {

        setPose : function(time){

            this._lerpField(time, 'position');
            this._lerpField(time, 'rotation');
            this._lerpField(time, 'scale');

        },

        _lerpField : function(time, fieldName){
            var poses = this.poses,
                len = poses.length,
                start,
                end;
            for(var i = 0; i < len; i++){
                if(poses[i].time <= time && poses[i][fieldName]){
                    start = poses[i];
                    break;
                }
            }
            i++;
            for(; i < len; i++){
                if(poses[i].time >= time && poses[i][fieldName]){
                    end = poses[i];
                    break;
                }
            }
            if(start && end){
                var percent = (time-start.time) / (end.time-start.time);
                percent = Math.max(Math.min(percent, 1), 0);
                if( fieldName === "rotation"){
                    this[fieldName].slerp(start[fieldName], end[fieldName], percent);
                }else{
                    this[fieldName].lerp(start[fieldName], end[fieldName], percent);
                }
            }
        }
    });

    return Bone;
});
define('3d/camera',['require','./node','core/matrix4'], function(require){

    var Node = require("./node");
    var Matrix4 = require("core/matrix4");

    var Camera = Node.derive(function() {
        return {
            projectionMatrix : new Matrix4(),
        }
    }, function(){
        this.update();
    }, {
        
        update : function( _gl ) {

            Node.prototype.update.call( this, _gl );
            
            this.updateProjectionMatrix();
        }
    });

    return Camera;
} );
define('3d/camera/orthographic',['require','../camera'], function(require){

    var Camera = require('../camera');

    var Orthographic = Camera.derive( function(){
        return {
            left : -1,
            right : 1,
            near : 0,
            far : 1,
            top : 1,
            bottom : -1,
        }
    }, {
        
        updateProjectionMatrix : function(){
            this.projectionMatrix.ortho(this.left, this.right, this.bottom, this.top, this.near, this.far);
        }
    });

    return Orthographic;
} );
define('3d/camera/perspective',['require','../camera'], function(require){

    var Camera = require('../camera');


    var Perspective = Camera.derive( function(){
        return {

            fov : 50,
            
            aspect : 1,
            
            near : 0.1,
            
            far : 2000
        }
    }, {
        
        updateProjectionMatrix : function(){
            var rad = this.fov / 180 * Math.PI;
            this.projectionMatrix.perspective(rad, this.aspect, this.near, this.far);
        }
    });

    return Perspective;
} );
;
define("3d/compositor", function(){});

define('3d/compositor/graph/graph',['require','core/base','_'], function( require ){

    var Base = require("core/base");
    var _ = require("_");

    var Graph = Base.derive( function(){
        return {

            _nodes : [],

            _finalNode : null
        }
    }, {

        
        add : function( node ){

            this._nodes.push( node );

            this.dirty("graph");
        },

        remove : function( node ){
            _.without( this._nodes, node );
            this.dirty("graph");
        },

        update : function(){
            for(var i = 0; i < this._nodes.length; i++){
                this._nodes[i].clear();
            }
            // Traverse all the nodes and build the graph
            for(var i = 0; i < this._nodes.length; i++){
                var node = this._nodes[i];

                if( ! node.inputs){
                    continue;
                }
                for(var inputName in node.inputs){
                    var fromPinInfo = node.inputs[ inputName ];

                    var fromPin = this.findPin( fromPinInfo );
                    if( fromPin ){
                        node.link( inputName, fromPin.node, fromPin.pin );
                    }else{
                        console.warn("Pin of "+fromPinInfo.node+"."+fromPinInfo.pin+" not exist");
                    }
                }
                if( ! node.outputs ){
                    this._finalNode = node;
                }
            }

        },

        findPin : function( info ){
            var node;
            if( typeof(info.node) === 'string'){
                for( var i = 0; i < this._nodes.length; i++){
                    var tmp = this._nodes[i];
                    if( tmp.name === info.node ){
                        node = tmp;
                    }
                }
            }else{
                node = info.node;
            }
            if( node ){
                if( node.outputs[info.pin] ){
                    return {
                        node : node,
                        pin : info.pin
                    }
                }
            }
        },

        load : function( json ){

        },

        render : function( renderer ){
            if( this.isDirty("graph") ){
                this.update();
                this.fresh("graph");
            }
            for(var i = 0; i < this._nodes.length; i++){
                this._nodes[i].updateReference();
            }
            if( this._finalNode ){
                this._finalNode.render( renderer );
            }
        }
    })
    
    return Graph;
});
define('3d/scene',['require','./node'], function(require){

    var Node = require('./node');

    var Scene = Node.derive( function(){
        return {

            // Global material of scene
            material : null,

            // Properties to save the light information in the scene
            // Will be set in the render function
            lightNumber : {},
            lightUniforms : {},
            // Filter function.
            // Called each render pass to omit the mesh don't want
            // to be rendered on the screen
            filter : null
        }
    },{
        
    });

    return Scene;
} );
/**
 *
 * PENDING: use perfermance hint and remove the array after the data is transfered?
 * static draw & dynamic draw?
 */
define('3d/geometry',['require','core/base','util/util','glmatrix','_'], function(require) {

    var Base = require("core/base");
    var util = require("util/util");
    var glMatrix = require("glmatrix");
    var vec3 = glMatrix.vec3;
    var vec2 = glMatrix.vec2;
    var mat2 = glMatrix.mat2;
    var mat4 = glMatrix.mat4;
    var _ = require("_");

    var arrSlice = Array.prototype.slice;

    var Geometry = Base.derive( function() {

        return {

            __GUID__ : util.genGUID(),
            
            attributes : {
                 position : {
                    type : 'float',
                    semantic : "POSITION",
                    size : 3,
                    value : []
                 },
                 texcoord0 : {
                    type : 'float',
                    semantic : "TEXCOORD_0",
                    size : 2,
                    value : []
                 },
                 texcoord1 : {
                    type : 'float',
                    semantic : "TEXCOORD_1",
                    size : 2,
                    value : []
                 },
                 normal : {
                    type : 'float',
                    semantic : "NORMAL",
                    size : 3,
                    value : []
                 },
                 tangent : {
                    type : 'float',
                    semantic : "TANGENT",
                    size : 4,
                    value : []
                 },
                 color : {
                    type : 'float',
                    semantic : "COLOR",
                    size : 3,
                    value : []
                 },
                 // For wireframe display
                 // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
                 barycentric : {
                    type : 'float',
                    size : 3,
                    value : []
                 },
                 // Skinning attributes
                 // Each vertex can be bind to 4 bones, because the 
                 // sum of weights is 1, so the weights is stored in vec3 and the last
                 // can be calculated by 1-w.x-w.y-w.z
                 boneWeight : {
                    type : 'float',
                    size : 3,
                    value : []
                 },
                 boneIndex : {
                    type : 'float',
                    size : 4,
                    value : []
                 }
            },

            useFaces : true,
            // Face is list of triangles, each face
            // is an array of the vertex indices of triangle
            faces : [],

            hint : 'STATIC_DRAW',

            //Max Value of Uint16, i.e. 0xfff
            chunkSize : 65535,

            _enabledAttributes : null,

            _verticesNumber : 0,

            // Save the normal type, can have face normal or vertex normal
            // Normally vertex normal is more smooth
            _normalType : "vertex",

            // Typed Array of each geometry chunk
            // [{
            //     attributeArrays:{},
            //     indicesArray : null
            // }]
            _arrayChunks : [],

            // Map of re organized vertices data
            _verticesReorganizedMap : [],
            _reorganizedFaces : []
        }
    }, {

        // Overwrite the dirty method
        dirty : function( field ) {
            if ( ! field ) {
                this.dirty("indices");
                for(var name in this.attributes){
                    this.dirty(name);
                }
                return;
            }
            for ( var contextId in this.cache._caches ) {
                this.cache._caches[ contextId ][ "dirty_"+field ] = true;
            }

            this._enabledAttributes = null;
        },

        getVerticesNumber : function() {
            this._verticesNumber = this.attributes.position.value.length;
            return this._verticesNumber;
        },

        getEnabledAttributes : function(){
            // Cache
            if( this._enabledAttributes){
                return this._enabledAttributes;
            }

            var result = {};
            var verticesNumber = this.getVerticesNumber();

            for(var name in this.attributes){
                var attrib = this.attributes[name];
                if( attrib.value &&
                    attrib.value.length ){
                    if( attrib.value.length === verticesNumber ){
                        result[name] = attrib;
                    }
                }
            }

            this._enabledAttributes = result;

            return result;
        },

        getDirtyAttributes : function( ){

            var result = {};
            var attributes = this.getEnabledAttributes();
            
            var noDirtyAttributes = true;
            for(var name in attributes ){
                var attrib = attributes[name];
                if( this.cache.get("dirty_"+name) ||
                    this.cache.miss("dirty_"+name) ){
                    result[name] = attributes[name];
                    noDirtyAttributes = false;
                }
            }
            if( ! noDirtyAttributes ){
                return result;
            }
        },

        getChunkNumber : function(){
            return this._arrayChunks.length;
        },

        getBufferChunks : function( _gl ) {

            this.cache.use(_gl.__GUID__ );

            var isDirty = this.cache.getContext();
            var dirtyAttributes = this.getDirtyAttributes();

            var isFacesDirty = this.cache.get("dirty_faces") || this.cache.miss("dirty_faces");

            if( dirtyAttributes ){
                this._updateAttributesAndIndicesArrays( dirtyAttributes, isFacesDirty );
                this._updateBuffer( _gl, dirtyAttributes, isFacesDirty );

                for (var name in dirtyAttributes ) {
                    isDirty[ "dirty_"+name ] = false ;
                }
            }
            return this.cache.get("chunks");
        },

        _updateAttributesAndIndicesArrays : function( attributes, isFacesDirty ){

            var self = this,
                cursors = {},
                verticesNumber = this.getVerticesNumber();
            
            var verticesReorganizedMap = this._verticesReorganizedMap;


            var ArrayConstructors = {};
            for(var name in attributes){
                // Type can be byte, ubyte, short, ushort, float
                switch( type ) {
                    case "byte":
                        ArrayConstructors[name] = Int8Array;
                        break;
                    case "ubyte":
                        ArrayConstructors[name] = Uint8Array;
                        break;
                    case "short":
                        ArrayConstructors[name] = Int16Array;
                        break;
                    case "ushort":
                        ArrayConstructors[name] = Uint16Array;
                        break;
                    default:
                        ArrayConstructors[name] = Float32Array;
                        break;
                }
                cursors[name] = 0;
            }

            var newChunk = function(chunkIdx){
                if( self._arrayChunks[chunkIdx] ){
                    return self._arrayChunks[chunkIdx];
                }
                var chunk = {
                    attributeArrays : {},
                    indicesArray : null
                };

                for(var name in attributes){
                    chunk.attributeArrays[name] = null;
                }

                for(var name in cursors){
                    cursors[name] = 0;
                }
                for(var i = 0; i < verticesNumber; i++){
                    verticesReorganizedMap[i] = -1;
                }
                
                self._arrayChunks.push(chunk);
                return chunk;
            }

            var attribNameList = Object.keys(attributes);
            // Split large geometry into chunks because index buffer
            // only support uint16 which means each draw call can only
             // have at most 65535 vertex data
            if( verticesNumber > this.chunkSize && this.useFaces ){
                var vertexCursor = 0,
                    chunkIdx = 0,
                    currentChunk;

                var chunkFaceStart = [0];
                var vertexUseCount = [];

                for(i = 0; i < verticesNumber; i++){
                    vertexUseCount[i] = -1;
                    verticesReorganizedMap[i] = -1;
                }
                if( isFacesDirty ){
                    if( this._reorganizedFaces.length !== this.faces.length){
                        for( i = 0; i < this.faces.length; i++){
                            this._reorganizedFaces[i] = [0, 0, 0];
                        }
                    }
                }

                currentChunk = newChunk(chunkIdx);

                for(var i = 0; i < this.faces.length; i++){
                    var face = this.faces[i];
                    var reorganizedFace = this._reorganizedFaces[i];
                    var i1 = face[0], i2 = face[1], i3 = face[2];
                    // newChunk
                    if( vertexCursor+3 > this.chunkSize){
                        chunkIdx++;
                        chunkFaceStart[chunkIdx] = i;
                        vertexCursor = 0;
                        currentChunk = newChunk(chunkIdx);
                    }
                    var newI1 = verticesReorganizedMap[i1] === -1;
                    var newI2 = verticesReorganizedMap[i2] === -1;
                    var newI3 = verticesReorganizedMap[i3] === -1;

                    for(var k = 0; k < attribNameList.length; k++){
                        var name = attribNameList[k],
                            attribArray = currentChunk.attributeArrays[name],
                            values = attributes[name].value,
                            size = attributes[name].size;
                        if( ! attribArray){
                            // Here use array to put data temporary because i can't predict
                            // the size of chunk precisely.
                            attribArray = currentChunk.attributeArrays[name] = [];
                        }
                        if( size === 1){
                            if( newI1 ){
                                attribArray[ cursors[name]++ ] = values[i1];
                            }
                            if( newI2 ){
                                attribArray[ cursors[name]++ ] = values[i2];
                            }
                            if( newI3 ){
                                attribArray[ cursors[name]++ ] = values[i3];
                            }
                        }
                        else{
                            if( newI1 ){
                                for(var j = 0; j < size; j++){
                                    attribArray[ cursors[name]++ ] = values[i1][j];
                                }
                            }
                            if( newI2 ){
                                for(var j = 0; j < size; j++){
                                    attribArray[ cursors[name]++ ] = values[i2][j];
                                }
                            }
                            if( newI3 ){
                                for(var j = 0; j < size; j++){
                                    attribArray[ cursors[name]++ ] = values[i3][j];
                                }
                            }
                        }
                    }
                    if( newI1 ){
                        verticesReorganizedMap[i1] = vertexCursor;
                        reorganizedFace[0] = vertexCursor;
                        vertexCursor++;
                    }else{
                        reorganizedFace[0] = verticesReorganizedMap[i1];
                    }
                    if( newI2 ){
                        verticesReorganizedMap[i2] = vertexCursor;
                        reorganizedFace[1] = vertexCursor;
                        vertexCursor++;
                    }else{
                        reorganizedFace[1] = verticesReorganizedMap[i2];
                    }
                    if( newI3 ){
                        verticesReorganizedMap[i3] = vertexCursor;
                        reorganizedFace[2] = vertexCursor;
                        vertexCursor++
                    }else{
                        reorganizedFace[2] = verticesReorganizedMap[i3];
                    }
                }
                //Create typedArray from existed array
                for(var c = 0; c < this._arrayChunks.length; c++){
                    var chunk = this._arrayChunks[c];
                    for(var name in chunk.attributeArrays){
                        var array = chunk.attributeArrays[name];
                        if( array instanceof Array){
                            chunk.attributeArrays[name] = new ArrayConstructors[name](array);
                        }
                    }
                }

                if( isFacesDirty ){
                    var chunkStart, chunkEnd, cursor, chunk;
                    for(var c = 0; c < this._arrayChunks.length; c++){
                        chunkStart = chunkFaceStart[c];
                        chunkEnd = chunkFaceStart[c+1] || this.faces.length;
                        cursor = 0;
                        chunk = this._arrayChunks[c];
                        var indicesArray = chunk.indicesArray;
                        if( ! indicesArray){
                            indicesArray = chunk.indicesArray = new Uint16Array( (chunkEnd-chunkStart)*3 );
                        }

                        for(var i = chunkStart; i < chunkEnd; i++){
                            indicesArray[cursor++] = this._reorganizedFaces[i][0];
                            indicesArray[cursor++] = this._reorganizedFaces[i][1];
                            indicesArray[cursor++] = this._reorganizedFaces[i][2];
                        }
                    }
                }
            }else{
                var chunk = newChunk(0);
                // Use faces
                if( this.useFaces ){
                    var indicesArray = chunk.indicesArray;
                    if( ! indicesArray){
                        indicesArray = chunk.indicesArray = new Uint16Array(this.faces.length*3);
                    }
                    var cursor = 0;
                    for(var i = 0; i < this.faces.length; i++){
                        indicesArray[cursor++] = this.faces[i][0];
                        indicesArray[cursor++] = this.faces[i][1];
                        indicesArray[cursor++] = this.faces[i][2];
                    }
                }
                for(var name in attributes){
                    var values = attributes[name].value,
                        type = attributes[name].type,
                        size = attributes[name].size,
                        attribArray = chunk.attributeArrays[name];
                    
                    if( ! attribArray){
                        attribArray = chunk.attributeArrays[name] = new ArrayConstructors[name](verticesNumber*size);
                    }

                    if( size === 1){
                        for(var i = 0; i < values.length; i++){
                            attribArray[i] = values[i];
                        }
                    }else{
                        var cursor = 0;
                        for(var i = 0; i < values.length; i++){
                            for(var j = 0; j < size; j++){
                                attribArray[cursor++] = values[i][j];
                            }
                        }
                    }
                }
            }

        },

        _updateBuffer : function( _gl, dirtyAttributes, isFacesDirty ) {

            var chunks = this.cache.get("chunks");
            if( ! chunks){
                chunks = [];
                // Intialize
                for(var i = 0; i < this._arrayChunks.length; i++){
                    chunks[i] = {
                        attributeBuffers : {},
                        indicesBuffer : null
                    }
                }
                this.cache.put("chunks", chunks);
            }
            for(var i = 0; i < chunks.length; i++){
                var chunk = chunks[i];
                if( ! chunk){
                    chunk = chunks[i] = {
                        attributeBuffers : {},
                        indicesBuffer : null
                    }
                }
                var attributeBuffers = chunk.attributeBuffers,
                    indicesBuffer = chunk.indicesBuffer;
                var arrayChunk = this._arrayChunks[i],
                    attributeArrays = arrayChunk.attributeArrays,
                    indicesArray = arrayChunk.indicesArray;

                for(var name in dirtyAttributes){
                    var attribute = dirtyAttributes[name],
                        value = attribute.value,
                        type = attribute.type,
                        semantic = attribute.semantic,
                        size = attribute.size;

                    var bufferInfo = attributeBuffers[name],
                        buffer;
                    if( bufferInfo ){
                        buffer = bufferInfo.buffer
                    }else{
                        buffer = _gl.createBuffer();
                    }
                    //TODO: Use BufferSubData?
                    _gl.bindBuffer( _gl.ARRAY_BUFFER, buffer );
                    _gl.bufferData( _gl.ARRAY_BUFFER, attributeArrays[name], _gl[ this.hint ] );

                    attributeBuffers[name] = {
                        type : type,
                        buffer : buffer,
                        size : size,
                        semantic : semantic,
                    }
                } 
                if( isFacesDirty && this.useFaces ){
                    if( ! indicesBuffer ){
                        indicesBuffer = chunk.indicesBuffer = {
                            buffer : _gl.createBuffer(),
                            count : indicesArray.length
                        }
                    }
                    _gl.bindBuffer( _gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer );
                    _gl.bufferData( _gl.ELEMENT_ARRAY_BUFFER, indicesArray, _gl[ this.hint ] );   
                }
            }
        },

        generateVertexNormals : function() {
            var faces = this.faces,
                len = faces.length,
                positions = this.attributes.position.value,
                normals = this.attributes.normal.value,
                normal = vec3.create();

                v12 = vec3.create(), v23 = vec3.create();

            var difference = positions.length - normals.length;
            for(var i = 0; i < normals.length; i++){
                vec3.set(normals[i], 0.0, 0.0, 0.0);
            }
            for(var i = normals.length; i < positions.length; i++){
                //Use array instead of Float32Array
                normals[i] = [0.0, 0.0, 0.0];
            }

            for(var f = 0; f < this.faces.length; f++){

                var face = faces[f],
                    i1 = face[0],
                    i2 = face[1],
                    i3 = face[2],
                    p1 = positions[i1],
                    p2 = positions[i2],
                    p3 = positions[i3];

                vec3.sub( v12, p1, p2 );
                vec3.sub( v23, p2, p3 );
                // Left Hand Cartesian Coordinate System
                vec3.cross( normal, v12, v23 );
                // Weighted by the triangle area
                vec3.add(normals[i1], normals[i1], normal);
                vec3.add(normals[i2], normals[i2], normal);
                vec3.add(normals[i3], normals[i3], normal);
            }
            for(var i = 0; i < normals.length; i++){
                vec3.normalize(normals[i], normals[i]);
            }

            this._normalType = "vertex";
        },

        generateFaceNormals : function() {
            if( ! this.isUniqueVertex() ){
                this.generateUniqueVertex();
            }

            var faces = this.faces,
                len = faces.length,
                positions = this.attributes.position.value,
                normals = this.attributes.normal.value,
                normal = vec3.create();

                v12 = vec3.create(), v23 = vec3.create();

            var isCopy = normals.length === positions.length;
            //   p1
            //  /  \
            // p3---p2
            for(var i = 0; i < len; i++){
                var face = faces[i],
                    i1 = face[0],
                    i2 = face[1],
                    i3 = face[2],
                    p1 = positions[i1],
                    p2 = positions[i2],
                    p3 = positions[i3];

                vec3.sub( v12, p1, p2 );
                vec3.sub( v23, p2, p3 );
                // Left Hand Cartesian Coordinate System
                vec3.cross( normal, v12, v23 );

                if( isCopy ){
                    vec3.copy(normals[i1], normal);
                    vec3.copy(normals[i2], normal);
                    vec3.copy(normals[i3], normal);
                }else{
                    normals[i1] = normals[i2] = normals[i3] = arrSlice.call(normal);
                }
            }

            this._normalType = "face";
        },
        // "Mathmatics for 3D programming and computer graphics, third edition"
        // section 7.8.2
        // http://www.crytek.com/download/Triangle_mesh_tangent_space_calculation.pdf
        generateTangents : function() {
            
            var texcoords = this.attributes.texcoord0.value,
                positions = this.attributes.position.value,
                tangents = this.attributes.tangent.value,
                normals = this.attributes.normal.value;

            var tan1 = [], tan2 = [],
                verticesNumber = this.getVerticesNumber();
            for(var i = 0; i < verticesNumber; i++){
                tan1[i] = [0.0, 0.0, 0.0];
                tan2[i] = [0.0, 0.0, 0.0];
            }

            var sdir = [0.0, 0.0, 0.0];
            var tdir = [0.0, 0.0, 0.0];
            for(var i = 0; i < this.faces.length; i++){
                var face = this.faces[i],
                    i1 = face[0],
                    i2 = face[1],
                    i3 = face[2],

                    st1 = texcoords[i1],
                    st2 = texcoords[i2],
                    st3 = texcoords[i3],

                    p1 = positions[i1],
                    p2 = positions[i2],
                    p3 = positions[i3];

                var x1 = p2[0] - p1[0],
                    x2 = p3[0] - p1[0],
                    y1 = p2[1] - p1[1],
                    y2 = p3[1] - p1[1],
                    z1 = p2[2] - p1[2],
                    z2 = p3[2] - p1[2];

                var s1 = st2[0] - st1[0],
                    s2 = st3[0] - st1[0],
                    t1 = st2[1] - st1[1],
                    t2 = st3[1] - st1[1];

                var r = 1.0 / (s1 * t2 - t1 * s2);
                sdir[0] = (t2 * x1 - t1 * x2) * r;
                sdir[1] = (t2 * y1 - t1 * y2) * r; 
                sdir[2] = (t2 * z1 - t1 * z2) * r;

                tdir[0] = (s1 * x2 - s2 * x1) * r;
                tdir[1] = (s1 * y2 - s2 * y1) * r;
                tdir[2] = (s1 * z2 - s2 * z1) * r;

                vec3.add(tan1[i1], tan1[i1], sdir);
                vec3.add(tan1[i2], tan1[i2], sdir);
                vec3.add(tan1[i3], tan1[i3], sdir);
                vec3.add(tan2[i1], tan2[i1], tdir);
                vec3.add(tan2[i2], tan2[i2], tdir);
                vec3.add(tan2[i3], tan2[i3], tdir);
            }
            var tmp = [0, 0, 0, 0];
            var nCrossT = [0, 0, 0];
            for(var i = 0; i < verticesNumber; i++){
                var n = normals[i];
                var t = tan1[i];

                // Gram-Schmidt orthogonalize
                vec3.scale(tmp, n, vec3.dot(n, t));
                vec3.sub(tmp, t, tmp);
                vec3.normalize(tmp, tmp);
                // Calculate handedness.
                vec3.cross(nCrossT, n, t);
                tmp[3] = vec3.dot( nCrossT, tan2[i] ) < 0.0 ? -1.0 : 1.0;
                tangents[i] = tmp.slice();
            }
        },

        isUniqueVertex : function() {
            if( this.faces.length && this.useFaces ){
                return this.getVerticesNumber() === this.faces.length * 3;
            }else{
                return true;
            }
        },

        generateUniqueVertex : function(){

            var vertexUseCount = [];
            // Intialize with empty value, read undefined value from array
            // is slow
            // http://jsperf.com/undefined-array-read
            for(var i = 0; i < this.getVerticesNumber(); i++){
                vertexUseCount[i] = 0;
            }

            var cursor = this.getVerticesNumber(),
                attributes = this.getEnabledAttributes(),
                faces = this.faces;

            function cloneAttribute( idx ){
                for(var name in attributes ){
                    var array = attributes[name].value;
                    var size = array[0].length || 1;
                    if( size === 1){
                        array.push( array[idx] );
                    }else{
                        array.push( arrSlice.call(array[idx]) );
                    }
                }
            }
            for(var i = 0; i < faces.length; i++){
                var face = faces[i],
                    i1 = face[0],
                    i2 = face[1],
                    i3 = face[2];
                if( vertexUseCount[i1] > 0 ){
                    cloneAttribute(i1);
                    face[0] = cursor;
                    cursor++;
                }
                if( vertexUseCount[i2] > 0 ){
                    cloneAttribute(i2);
                    face[1] = cursor;
                    cursor++;
                }
                if( vertexUseCount[i3] > 0 ){
                    cloneAttribute(i3);
                    face[2] = cursor;
                    cursor++;
                }
                vertexUseCount[i1]++;
                vertexUseCount[i2]++;
                vertexUseCount[i3]++;
            }

            this.dirty();
        },

        // http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/
        // http://en.wikipedia.org/wiki/Barycentric_coordinate_system_(mathematics)
        generateBarycentric : (function(){
            var a = [1, 0, 0],
                b = [0, 0, 1],
                c = [0, 1, 0];
            return function(){

                if( ! this.isUniqueVertex() ){
                    this.generateUniqueVertex();
                }

                var array = this.attributes.barycentric.value;
                // Already existed;
                if( array.length == this.faces.length * 3){
                    return;
                }
                var i1, i2, i3, face;
                for(var i = 0; i < this.faces.length; i++){
                    face = this.faces[i];
                    i1 = face[0];
                    i2 = face[1];
                    i3 = face[2];
                    array[i1] = a;
                    array[i2] = b;
                    array[i3] = c;
                }
            }
        })(),
        // TODO : tangent
        applyMatrix : function( matrix ) {
            var positions = this.attributes.position.value;
            var normals = this.attributes.normal.value;

            matrix = matrix._array;
            for ( var i = 0; i < positions.length; i++) {
                vec3.transformMat4( positions[i], positions[i], matrix );
            }
            // Normal Matrix
            var inverseTransposeMatrix = mat4.create();
            mat4.invert( inverseTransposeMatrix, matrix );
            mat4.transpose( inverseTransposeMatrix, inverseTransposeMatrix );

            for( var i = 0; i < normals.length; i++) {
                vec3.transformMat4( normals[i], normals[i], inverseTransposeMatrix );
            }
        },

        dispose : function(_gl) {
            
        }
    } )

    return Geometry;
} );
/*
 * From lightgl
 * https://github.com/evanw/lightgl.js/blob/master/src/mesh.js
 */
define('3d/geometry/plane',['require','../geometry'], function(require){

	var Geometry = require('../geometry');

	var Plane = Geometry.derive( function(){

		return {
			widthSegments : 1,
			heightSegments : 1
		}
	}, function(){

		var heightSegments = this.heightSegments,
			widthSegments = this.widthSegments,
			positions = this.attributes.position.value,
			texcoords = this.attributes.texcoord0.value,
			normals = this.attributes.normal.value,
			faces = this.faces;			

		for (var y = 0; y <= heightSegments; y++) {
			var t = y / heightSegments;
			for (var x = 0; x <= widthSegments; x++) {
				var s = x / widthSegments;

				positions.push([2 * s - 1, 2 * t - 1, 0]);
				if ( texcoords ) texcoords.push([s, t]);

				if ( normals ) normals.push([0, 0, 1]);
				if (x < widthSegments && y < heightSegments) {
					var i = x + y * (widthSegments + 1);
					faces.push([i, i + 1, i + widthSegments + 1]);
					faces.push([i + widthSegments + 1, i + 1, i + widthSegments + 2]);
				}
			}
		}

	})

	return Plane;
} );
/**
 * Mainly do the parse and compile of shader string
 * Support shader code chunk import and export
 * Support shader semantics
 * http://www.nvidia.com/object/using_sas.html
 * https://github.com/KhronosGroup/collada2json/issues/45
 *
 */
define('3d/shader',['require','core/base','glmatrix','util/util','_'], function(require){
    
    var Base = require("core/base"),
        glMatrix = require("glmatrix"),
        mat2 = glMatrix.mat2
        mat3 = glMatrix.mat3,
        mat4 = glMatrix.mat4,
        vec2 = glMatrix.vec2,
        vec3 = glMatrix.vec3,
        vec4 = glMatrix.vec4,
        util = require("util/util"),
        _ = require("_");

    var uniformRegex = /uniform\s+(bool|float|int|vec2|vec3|vec4|ivec2|ivec3|ivec4|mat2|mat3|mat4|sampler2D|samplerCube)\s+(\w+)?(\[.*?\])?\s*(:\s*([\S\s]+?))?;/g;
    var attributeRegex = /attribute\s+(float|int|vec2|vec3|vec4)\s+(\w*)\s*(:\s*(\w+))?;/g;

    var uniformTypeMap = {
        "bool" : "1i",
        "int" : "1i",
        "sampler2D" : "t",
        "samplerCube" : "t",
        "float" : "1f",
        "vec2" : "2f",
        "vec3" : "3f",
        "vec4" : "4f",
        "ivec2" : "2i",
        "ivec3" : "3i",
        "ivec4" : "4i",
        "mat2" : "m2",
        "mat3" : "m3",
        "mat4" : "m4"
    }
    var uniformValueConstructor = {
        'bool' : function(){return true;},
        'int' : function(){return 0;},
        'float' : function(){return 0;},
        'sampler2D' : function(){return null;},
        'samplerCube' : function(){return null;},

        'vec2' : function(){return new Float32Array(2);},
        'vec3' : function(){return new Float32Array(3);},
        'vec4' : function(){return new Float32Array(4);},

        'ivec2' : function(){return new Int32Array(2);},
        'ivec3' : function(){return new Int32Array(3);},
        'ivec4' : function(){return new Int32Array(4);},

        'mat2' : function(){return mat2.create();},
        'mat3' : function(){return mat3.create();},
        'mat4' : function(){return mat4.create();},

        'array' : function(){return [];}
    }
    var availableSemantics = [
            'POSITION', 
            'NORMAL',
            'BINORMAL',
            'TANGENT',
            'TEXCOORD',
            'TEXCOORD_0',
            'TEXCOORD_1',
            'COLOR',
            'WORLD',
            'VIEW',
            'PROJECTION',
            'WORLDVIEW',
            'VIEWPROJECTION',
            'WORLDVIEWPROJECTION',
            'WORLDINVERSE',
            'VIEWINVERSE',
            'PROJECTIONINVERSE',
            'WORLDVIEWINVERSE',
            'VIEWPROJECTIONINVERSE',
            'WORLDVIEWPROJECTIONINVERSE',
            'WORLDTRANSPOSE',
            'VIEWTRANSPOSE',
            'PROJECTIONTRANSPOSE',
            'WORLDVIEWTRANSPOSE',
            'VIEWPROJECTIONTRANSPOSE',
            'WORLDVIEWPROJECTIONTRANSPOSE',
            'WORLDINVERSETRANSPOSE',
            'VIEWINVERSETRANSPOSE',
            'PROJECTIONINVERSETRANSPOSE',
            'WORLDVIEWINVERSETRANSPOSE',
            'VIEWPROJECTIONINVERSETRANSPOSE',
            'WORLDVIEWPROJECTIONINVERSETRANSPOSE'];
    
    var errorShader = {};

    // Enable attribute operation is global to all programs
    // Here saved the list of all enabled attribute index 
    // http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
    var enabledAttributeList = {};

    var Shader = Base.derive( function(){

        return {

            __GUID__ : util.genGUID(),

            vertex : "",
            
            fragment : "",

            precision : "mediump",
            // Properties follow will be generated by the program
            semantics : {},

            uniformTemplates : {},
            attributeTemplates : {},

            // Custom defined values in the shader
            vertexDefines : {},
            fragmentDefines : {},
            // Glue code
            // Defines the each type light number in the scene
            // AMBIENT_LIGHT
            // POINT_LIGHT
            // SPOT_LIGHT
            // AREA_LIGHT
            lightNumber : {},
            // {
            //  enabled : true
            //  shaderType : "vertex",
            // }
            _textureStatus : {},

            _vertexProcessed : "",
            _fragmentProcessed : "",

            _program : null,

        }
    }, function(){

        this.update();

    }, {

        setVertex : function(str){
            this.vertex = str;
            this.update();
        },
        setFragment : function(str){
            this.fragment = str;_caches
            this.update();
        },
        bind : function( _gl ){

            this.cache.use( _gl.__GUID__ , {
                "locations" : {},
                "attriblocations" : {}
            } );

            if( this.cache.get("dirty") || this.cache.miss("program") ){
                
                this._buildProgram( _gl, this._vertexProcessed, this._fragmentProcessed );
            
                this.cache.put("dirty", false);
            }

            _gl.useProgram( this.cache.get("program") );
        },
        // Overwrite the dirty method
        dirty : function(){
            for( var contextId in this.cache._caches){
                var context = this.cache._caches[contextId];
                context["dirty"] = true;
                context["locations"] = {};
                context["attriblocations"] = {};
            }
        },

        update : function( force ){

            if( this.vertex !== this._vertexPrev ||
                this.fragment !== this._fragmentPrev || force){

                this._parseImport();
                
                this.semantics = {};
                this._textureStatus = {};

                this._parseUniforms();
                this._parseAttributes();

                this._vertexPrev = this.vertex;
                this._fragmentPrev = this.fragment;
            }
            this._addDefine();

            this.dirty();
        },

        enableTexture : function( symbol, autoUpdate ){
            var status = this._textureStatus[ symbol ];
            if( status ){
                var isEnabled = status.enabled;
                if( isEnabled ){
                    // Do nothing
                    return;
                }else{
                    status.enabled = true;

                    var autoUpdate = typeof(autoUpdate)==="undefined" || true;
                    if(autoUpdate){
                        this.update();
                    }
                }
            }
        },

        enableTexturesAll : function(autoUpdate){
            for(var symbol in this._textureStatus){
                this._textureStatus[symbol].enabled = true;
            }

            var autoUpdate = typeof(autoUpdate)==="undefined" || true;
            if(autoUpdate){
                this.update();
            }
        },

        disableTexture : function( symbol, autoUpdate ){
            var status = this._textureStatus[ symbol ];
            if( status ){
                var isDisabled = ! status.enabled;
                if( isDisabled){
                    // Do nothing
                    return;
                }else{
                    status.enabled = false;

                    var autoUpdate = typeof(autoUpdate)==="undefined" || true;
                    if(autoUpdate){
                        this.update();
                    }
                }
            }
        },

        disableTexturesAll : function(symbol, autoUpdate){
            for(var symbol in this._textureStatus){
                this._textureStatus[symbol].enabled = false;
            }

            var autoUpdate = typeof(autoUpdate)==="undefined" || true;
            if(autoUpdate){
                this.update();
            }
        },

        setUniform : function( _gl, type, symbol, value ){

            var program = this.cache.get("program");            

            var locationsMap = this.cache.get( "locations" );
            var location = locationsMap[symbol];
            // Uniform is not existed in the shader
            if( location === null){
                return;
            }
            else if( ! location ){
                location = _gl.getUniformLocation( program, symbol );
                // Unform location is a WebGLUniformLocation Object
                // If the uniform not exist, it will return null
                if( location === null  ){
                    locationsMap[symbol] = null;
                    return;
                }
                locationsMap[symbol] = location;
            }
            switch( type ){
                case '1i':
                    _gl.uniform1i( location, value );
                    break;
                case '1f':
                    _gl.uniform1f( location, value );
                    break;
                case "1fv":
                    _gl.uniform1fv( location, value );
                    break;
                case "1iv":
                    _gl.uniform1iv( location, value );
                    break;
                case '2iv':
                    _gl.uniform2iv( location, value );
                    break;
                case '2fv':
                    _gl.uniform2fv( location, value );
                    break;
                case '3iv':
                    _gl.uniform3iv( location, value );
                    break;
                case '3fv':
                    _gl.uniform3fv( location, value );
                    break;
                case "4iv":
                    _gl.uniform4iv( location, value );
                    break;
                case "4fv":
                    _gl.uniform4fv( location, value );
                    break;
                case '2i':
                    _gl.uniform2i( location, value[0], value[1] );
                    break;
                case '2f':
                    _gl.uniform2f( location, value[0], value[1] );
                    break;
                case '3i':
                    _gl.uniform3i( location, value[0], value[1], value[2] );
                    break;
                case '3f':
                    _gl.uniform3f( location, value[0], value[1], value[2] );
                    break;
                case '4i':
                    _gl.uniform4i( location, value[0], value[1], value[2], value[3] );
                    break;
                case '4f':
                    _gl.uniform4f( location, value[0], value[1], value[2], value[3] );
                    break;
                case 'm2':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix2fv(location, false, value);
                    break;
                case 'm3':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix3fv(location, false, value);
                    break;
                case 'm4':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix4fv(location, false, value);
                    break;
                case "m2v":
                    var size = 4;
                case "m3v":
                    var size = 9;
                case 'm4v':
                    var size = 16;
                    if( value instanceof Array){
                        var array = new Float32Array(value.length * size);
                        var cursor = 0;
                        for(var i = 0; i < value.length; i++){
                            var item = value[i];
                            for(var j = 0; j < item.length; j++){
                                array[cursor++] = item[j];
                            }
                        }
                        _gl.uniformMatrix4fv(location, false, array);
                    // Raw value
                    }else if( value instanceof Float32Array){   // ArrayBufferView
                        _gl.uniformMatrix4fv(location, false, value);
                    }
                    break;
            }
        },
        /**
         * Enable the attributes passed in and disable the rest
         * Example Usage:
         * enableAttributes( _gl, "position", "texcoords")
         * OR
         * enableAttributes(_gl, ["position", "texcoors"])
         */
        enableAttributes : function( _gl, attribList ){
            
            var program = this.cache.get("program");

            var locationsMap = this.cache.get("attriblocations");

            if( typeof(attribList) === "string"){
                attribList = Array.prototype.slice.call(arguments, 1);
            }

            var enabledAttributeListInContext = enabledAttributeList[_gl.__GUID__];
            if( ! enabledAttributeListInContext ){
                enabledAttributeListInContext = enabledAttributeList[_gl.__GUID__] = [];
            }

            for(var symbol in this.attributeTemplates){
                var location = locationsMap[symbol];                        
                if( typeof(location) === "undefined" ){
                    location = _gl.getAttribLocation( program, symbol );
                    // Attrib location is a number from 0 to ...
                    if( location === -1){
                        continue;
                    }
                    locationsMap[symbol] = location;
                }

                if(attribList.indexOf(symbol) >= 0){
                    if( ! enabledAttributeListInContext[location] ){
                        _gl.enableVertexAttribArray(location);
                        enabledAttributeListInContext[location] = true;
                    }
                }else{
                    if( enabledAttributeListInContext[location]){
                        _gl.disableVertexAttribArray(location);
                        enabledAttributeListInContext[location] = false;
                    }
                }
            }
        },

        setMeshAttribute : function( _gl, symbol, info ){
            var type = info.type,
                size = info.size,
                glType;
            switch( type ){
                case "byte":
                    glType = _gl.BYTE;
                    break;
                case "ubyte":
                    glType = _gl.UNSIGNED_BYTE;
                    break;
                case "short":
                    glType = _gl.SHORT;
                    break;
                case "ushort":
                    glType = _gl.UNSIGNED_SHORT;
                    break;
                default:
                    glType = _gl.FLOAT;
                    break;
            }

            var program = this.cache.get("program");            

            var locationsMap = this.cache.get("attriblocations");
            var location = locationsMap[symbol];

            if( typeof(location) === "undefined" ){
                location = _gl.getAttribLocation( program, symbol );
                // Attrib location is a number from 0 to ...
                if( location === -1){
                    return;
                }
                locationsMap[symbol] = location;
            }

            _gl.vertexAttribPointer( location, size, glType, false, 0, 0 );
        },

        _parseImport : function(){

            this._vertexProcessedWithoutDefine = Shader.parseImport( this.vertex );
            this._fragmentProcessedWithoutDefine = Shader.parseImport( this.fragment );

        },

        _addDefine : function(){

            // Add defines
            var defineStr = [];
            _.each( this.lightNumber, function(count, lightType){
                if( count ){
                    defineStr.push( "#define "+lightType.toUpperCase()+"_NUMBER "+count );
                }
            });
            _.each( this._textureStatus, function(status, symbol){
                if( status.enabled && status.shaderType === "vertex" ){
                    defineStr.push( "#define "+symbol.toUpperCase()+"_ENABLED" );
                }
            });
            // Custom Defines
            _.each( this.vertexDefines, function(value, symbol){
                if( value === null){
                    defineStr.push("#define "+symbol);
                }else{
                    defineStr.push("#define "+symbol+" "+value.toString());
                }
            } )
            this._vertexProcessed = defineStr.join("\n") + "\n" + this._vertexProcessedWithoutDefine;

            defineStr = [];
            _.each( this.lightNumber, function( count, lightType){
                if( count ){
                    defineStr.push( "#define "+lightType+"_NUMBER "+count );
                }
            });
            _.each( this._textureStatus, function( status, symbol){
                if( status.enabled && status.shaderType === "fragment" ){
                    defineStr.push( "#define "+symbol.toUpperCase()+"_ENABLED" );
                }
            });
            // Custom Defines
            _.each( this.fragmentDefines, function(value, symbol){
                if( value === null){
                    defineStr.push("#define "+symbol);
                }else{
                    defineStr.push("#define "+symbol+" "+value.toString());
                }
            } )
            var tmp = defineStr.join("\n") + "\n" + this._fragmentProcessedWithoutDefine;
            
            // Add precision
            this._fragmentProcessed = ['precision', this.precision, 'float'].join(' ')+';\n' + tmp;
        },

        _parseUniforms : function(){
            var uniforms = {},
                self = this;
            var shaderType = "vertex";
            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace( uniformRegex, _uniformParser );
            shaderType = "fragment";
            this._fragmentProcessedWithoutDefine = this._fragmentProcessedWithoutDefine.replace( uniformRegex, _uniformParser );

            function _uniformParser(str, type, symbol, isArray, semanticWrapper, semantic){
                if( type && symbol ){
                    var uniformType = uniformTypeMap[type];
                    if( uniformType ){
                        if( type === "sampler2D" || type === "samplerCube" ){
                            // Texture is default disabled
                            self._textureStatus[symbol] = {
                                enabled : false,
                                shaderType : shaderType
                            };
                        }
                        if( isArray ){
                            uniformType += 'v';
                        }
                        if( semantic ){
                            if( availableSemantics.indexOf(semantic) < 0 ){
                                var defaultValueFunc = self._parseDefaultValue( type, semantic );
                                if( ! defaultValueFunc)
                                    console.warn('Unkown semantic "' + semantic + '"');
                                else
                                    semantic = "";
                            }else{
                                self.semantics[ semantic ] = {
                                    symbol : symbol,
                                    type : uniformType
                                }
                            }
                        }   
                        uniforms[ symbol ] = {
                            type : uniformType,
                            value : isArray ? uniformValueConstructor['array'] : ( defaultValueFunc || uniformValueConstructor[ type ] ),
                            semantic : semantic || null
                        }
                    }
                    return ["uniform", type, symbol, isArray].join(" ")+";\n";
                }
            }

            this.uniformTemplates = uniforms;
        },

        _parseDefaultValue : function(type, str){
            var arrayRegex = /\[\s*(.*)\s*\]/
            if( type === "vec2" ||
                type === "vec3" ||
                type === "vec4"){
                var arrayStr = arrayRegex.exec(str)[1];
                if( arrayStr ){
                    var arr = arrayStr.split(/\s*,\s*/);
                    return function(){
                        return new Float32Array(arr);
                    }
                }else{
                    // Invalid value
                    return;
                }
            }
            else if( type === "bool" ){
                return function(){
                    return str.toLowerCase() === "true" ? true : false;
                }
            }
            else if( type === "float" ){
                return function(){
                    return parseFloat(str);
                }
            }
        },

        // Create a new uniform instance for material
        createUniforms : function(){
            var uniforms = {};
            
            _.each( this.uniformTemplates, function( uniformTpl, symbol ){
                uniforms[ symbol ] = {
                    type : uniformTpl.type,
                    value : uniformTpl.value()
                }
            } )

            return uniforms;
        },

        _parseAttributes : function(){
            var attributes = {},
                self = this;
            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace( attributeRegex, _attributeParser );

            function _attributeParser( str, type, symbol, semanticWrapper, semantic ){
                if( type && symbol ){
                    var size = 1;
                    switch( type ){
                        case "vec4":
                            size = 4;
                            break;
                        case "vec3":
                            size = 3;
                            break;
                        case "vec2":
                            size = 2;
                            break;
                        case "float":
                            size = 1;
                            break;
                    }

                    attributes[ symbol ] = {
                        // Force float
                        type : "float",
                        size : size,
                        semantic : semantic || null
                    }

                    if( semantic ){
                        if( availableSemantics.indexOf(semantic) < 0 ){
                            console.warn('Unkown semantic "' + semantic + '"');
                        }else{
                            self.semantics[ semantic ] = {
                                symbol : symbol,
                                type : type
                            }
                        }
                    }
                }

                return ["attribute", type, symbol].join(" ")+";\n";
            }

            this.attributeTemplates = attributes;
        },

        _buildProgram : function(_gl, vertexShaderString, fragmentShaderString){

            if( this.cache.get("program") ){
                _gl.deleteProgram( this.cache.get("program") );
            }
            var program = _gl.createProgram();

            try{

                var vertexShader = this._compileShader(_gl, "vertex", vertexShaderString);
                var fragmentShader = this._compileShader(_gl, "fragment", fragmentShaderString);
                _gl.attachShader( program, vertexShader );
                _gl.attachShader( program, fragmentShader );

                _gl.linkProgram( program );

                if ( !_gl.getProgramParameter( program, _gl.LINK_STATUS ) ) {
                    throw new Error( "Could not initialize shader\n" + "VALIDATE_STATUS: " + _gl.getProgramParameter( program, _gl.VALIDATE_STATUS ) + ", gl error [" + _gl.getError() + "]" );
                }
            }catch(e){
                if( errorShader[ this.__GUID__] ){
                    return;
                }
                errorShader[ this.__GUID__ ] = this;
                throw e; 
            }

            _gl.deleteShader( vertexShader );
            _gl.deleteShader( fragmentShader );

            this.cache.put("program", program);
        },

        _compileShader : function(_gl, type, shaderString){
            var shader = _gl.createShader( type === "fragment" ? _gl.FRAGMENT_SHADER : _gl.VERTEX_SHADER );
            _gl.shaderSource( shader, shaderString );
            _gl.compileShader( shader );

            if ( !_gl.getShaderParameter( shader, _gl.COMPILE_STATUS ) ) {
                throw new Error( [_gl.getShaderInfoLog( shader ),
                                    addLineNumbers(shaderString) ].join("\n") );
            }
            return shader;
        },

        dispose : function(){
            
        }
    });
        
    // some util functions
    function addLineNumbers( string ){
        var chunks = string.split( "\n" );
        for ( var i = 0, il = chunks.length; i < il; i ++ ) {
            // Chrome reports shader errors on lines
            // starting counting from 1
            chunks[ i ] = ( i + 1 ) + ": " + chunks[ i ];
        }
        return chunks.join( "\n" );
    }

    var importRegex = /(@import)\s*([0-9a-zA-Z_\-\.]*)/g;
    Shader.parseImport = function( shaderStr ){
        shaderStr = shaderStr.replace( importRegex, function(str, importSymbol, importName ){
            if( _source[importName] ){
                // Recursively parse
                return Shader.parseImport( _source[ importName ] );
            }
        } )
        return shaderStr;
    }

    var exportRegex = /(@export)\s*([0-9a-zA-Z_\-\.]*)\s*\n([\s\S]*?)@end/g;
    // Import the shader to library and chunks
    Shader.import = function( shaderStr ){

        shaderStr.replace( exportRegex, function(str, exportSymbol, exportName, code){
            _source[ exportName ] = code;
            return code;
        } )
    }

    // Library to store all the loaded shader strings
    var _source = {};

    Shader.source = function( name ){
        var shaderStr = _source[name];
        if( ! shaderStr ){
            console.error( 'Shader "' + name + '" not existed in library');
            return;
        }
        return shaderStr;
    }

    return Shader;
} );
/**
 * Base class for all textures like compressed texture, texture2d, texturecube
 * TODO mapping
 */
define('3d/texture',['require','core/base','_'], function(require){

    var Base = require("core/base"),
        _ = require("_");

    var Texture = Base.derive( function(){

        return {

            // Width and height is used when the image is null and want
            // to use it as a texture attach to framebuffer( RTT )
            width : 512,
            height : 512,

            // UNSIGNED_BYTE 
            // FLOAT
            type : 'UNSIGNED_BYTE',
            // ALPHA
            // RGB
            // RGBA
            // LUMINANCE
            // LUMINANCE_ALPHA
            format : 'RGBA',
            // 'CLAMP_TO_EDGE'
            // 'REPEAT'
            // 'MIRRORED_REPEAT'
            wrapS : 'CLAMP_TO_EDGE',
            wrapT : 'CLAMP_TO_EDGE',
            // Texture min and mag filter
            // http://www.khronos.org/registry/gles/specs/2.0/es_full_spec_2.0.25.pdf
            // NEARST
            // LINEAR
            // NEAREST_MIPMAP_NEAREST
            // NEAREST_MIPMAP_LINEAR
            // LINEAR_MIPMAP_NEAREST
            // LINEAR_MIPMAP_LINEAR
            minFilter : 'LINEAR_MIPMAP_LINEAR',
            // NEARST
            // LINEAR
            magFilter : 'LINEAR',

            generateMipmaps : true,

            // http://blog.tojicode.com/2012/03/anisotropic-filtering-in-webgl.html
            anisotropic : 1,
            // pixelStorei parameters
            // http://www.khronos.org/opengles/sdk/docs/man/xhtml/glPixelStorei.xml
            flipY : true,
            unpackAlignment : 4,
            premultiplyAlpha : false,

            NPOT : false
        }
    }, {

        getWebGLTexture : function( _gl ){

            this.cache.use( _gl.__GUID__ );

            if( this.cache.miss( "webgl_texture" ) ){
                // In a new gl context, create new texture and set dirty true
                this.cache.put( "webgl_texture", _gl.createTexture() );
                this.cache.put( "dirty", true );
            }
            if( this.cache.get("dirty") ){
                this.update( _gl );
                this.cache.put("dirty", false);
            }

            return this.cache.get( "webgl_texture" );
        },

        bind : function(){},
        unbind : function(){},
        
        // Overwrite the dirty method
        dirty : function(){
            for( var contextId in this.cache._caches ){
                this.cache._caches[ contextId ][ "dirty" ] = true;
            }
        },

        update : function( _gl ){},

        // Update the common parameters of texture
        beforeUpdate : function( _gl ){
            _gl.pixelStorei( _gl.UNPACK_FLIP_Y_WEBGL, this.flipY );
            _gl.pixelStorei( _gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiplyAlpha );
            _gl.pixelStorei( _gl.UNPACK_ALIGNMENT, this.unpackAlignment );

            this.fallBack();
        },

        fallBack : function(){

            // Use of none-power of two texture
            // http://www.khronos.org/webgl/wiki/WebGL_and_OpenGL_Differences
            
            var isPowerOfTwo = this.isPowerOfTwo();

            if( this.format === "DEPTH_COMPONENT"){
                this.generateMipmaps = false;
            }

            if( ! isPowerOfTwo || ! this.generateMipmaps){
                // none-power of two flag
                this.NPOT = true;
                // Save the original value for restore
                this._minFilterOriginal = this.minFilter;
                this._magFilterOriginal = this.magFilter;
                this._wrapSOriginal = this.wrapS;
                this._wrapTOriginal = this.wrapT;

                if( this.minFilter.indexOf("NEAREST") == 0){
                    this.minFilter = 'NEAREST';
                }else{
                    this.minFilter = 'LINEAR'
                }

                if( this.magFilter.indexOf("NEAREST") == 0){
                    this.magFilter = 'NEAREST';
                }else{
                    this.magFilter = 'LINEAR'
                }

                this.wrapS = 'CLAMP_TO_EDGE';
                this.wrapT = 'CLAMP_TO_EDGE';
            }else{
                if( this._minFilterOriginal ){
                    this.minFilter = this._minFilterOriginal;
                }
                if( this._magFilterOriginal ){
                    this.magFilter = this._magFilterOriginal;
                }
                if( this._wrapSOriginal ){
                    this.wrapS = this._wrapSOriginal;
                }
                if( this._wrapTOriginal ){
                    this.wrapT = this._wrapTOriginal;
                }
            }

        },

        nextHighestPowerOfTwo : function(x) {
            --x;
            for (var i = 1; i < 32; i <<= 1) {
                x = x | x >> i;
            }
            return x + 1;
        },

        dispose : function( _gl ){
            this.cache.use(_gl.__GUID__);
            _gl.deleteTexture( this.cache.get("webgl_texture") );
        },

        isRenderable : function(){},
        
        isPowerOfTwo : function(){},
    } )

    return Texture;
} );
/**
 * @export{class} WebGLInfo
 */
define('3d/webglinfo',[], function(){


    // http://www.khronos.org/registry/webgl/extensions/
    var EXTENSION_LIST = ["OES_texture_float",
                            "OES_texture_half_float",
                            "OES_standard_derivatives",
                            "OES_vertex_array_object",
                            "OES_element_index_uint",
                            "WEBGL_compressed_texture_s3tc",
                            'WEBGL_depth_texture',
                            "EXT_texture_filter_anisotropic",
                            "EXT_draw_buffers"];

    var initialized = false;

    var extensions = {};

    var WebGLInfo = {

        initialize : function( _gl ){
            if(initialized){
                return;
            }
            // Basic info

            // Get webgl extension
            for(var i = 0; i < EXTENSION_LIST.length; i++){
                var extName = EXTENSION_LIST[i];

                var ext = _gl.getExtension(extName);
                // Try vendors
                if( ! ext){
                    ext = _gl.getExtension("MOZ_" + extName);
                }
                if( ! ext){
                    ext = _gl.getExtension("WEBKIT_" + extName);
                }

                extensions[extName] = ext;
            }

            initialized = true;
        },

        getExtension : function(name){
            return extensions[name];
        }
    }

    return WebGLInfo;
} );
/**
 *
 * @export{class} Texture2D
 */
define('3d/texture/texture2d',['require','../texture','../webglinfo'], function(require){

    var Texture = require('../texture');
    var WebGLInfo = require('../webglinfo');

    var Texture2D = Texture.derive({
        
        image : null,

        pixels : null,
    }, {
        update : function( _gl ){

            _gl.bindTexture( _gl.TEXTURE_2D, this.cache.get("webgl_texture") );
            
            this.beforeUpdate(  _gl );

            var glFormat = _gl[ this.format.toUpperCase() ],
                glType = _gl[ this.type.toUpperCase() ];

            _gl.texParameteri( _gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl[ this.wrapS.toUpperCase() ] );
            _gl.texParameteri( _gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl[ this.wrapT.toUpperCase() ] );

            _gl.texParameteri( _gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl[ this.magFilter.toUpperCase() ] );
            _gl.texParameteri( _gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl[ this.minFilter.toUpperCase() ] );
            
            var anisotropicExt = WebGLInfo.getExtension("EXT_texture_filter_anisotropic");
            if( anisotropicExt){
                _gl.texParameterf(_gl.TEXTURE_2D, anisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic);
            }

            if( this.image ){
                // After image is loaded
                if( this.image.complete )
                    _gl.texImage2D( _gl.TEXTURE_2D, 0, glFormat, glFormat, glType, this.image );
            }
            // Can be used as a blank texture when writing render to texture(RTT)
            else{
                _gl.texImage2D( _gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, glFormat, glType, this.pixels);
            }           
        
            if( ! this.NPOT && this.generateMipmaps ){
                _gl.generateMipmap( _gl.TEXTURE_2D );
            }
            
            _gl.bindTexture( _gl.TEXTURE_2D, null );

        },
        
        isPowerOfTwo : function(){
            if( this.image ){
                var width = this.image.width,
                    height = this.image.height;   
            }else{
                var width = this.width,
                    height = this.height;
            }
            return ( width & (width-1) ) === 0 &&
                    ( height & (height-1) ) === 0;
        },

        isRenderable : function(){
            if( this.image ){
                return this.image.complete;
            }else{
                return this.width && this.height;
            }
        },

        bind : function( _gl ){
            _gl.bindTexture( _gl.TEXTURE_2D, this.getWebGLTexture(_gl) );
        },
        unbind : function( _gl ){
            _gl.bindTexture( _gl.TEXTURE_2D, null );
        },
    })

    return Texture2D;
} );
/**
 *
 * @export{class} TextureCube
 */
define('3d/texture/texturecube',['require','../texture','../webglinfo','_'], function(require){

    var Texture = require('../texture');
    var WebGLInfo = require('../webglinfo');
    var _ = require('_');

    var targetMap = {
        'px' : 'TEXTURE_CUBE_MAP_POSITIVE_X',
        'py' : 'TEXTURE_CUBE_MAP_POSITIVE_Y',
        'pz' : 'TEXTURE_CUBE_MAP_POSITIVE_Z',
        'nx' : 'TEXTURE_CUBE_MAP_NEGATIVE_X',
        'ny' : 'TEXTURE_CUBE_MAP_NEGATIVE_Y',
        'nz' : 'TEXTURE_CUBE_MAP_NEGATIVE_Z',
    }

    var TextureCube = Texture.derive({
        image : {
            px : null,
            nx : null,
            py : null,
            ny : null,
            pz : null,
            nz : null
        },
        pixels : {
            px : null,
            nx : null,
            py : null,
            ny : null,
            pz : null,
            nz : null
        }
    }, {

        update : function( _gl ){

            _gl.bindTexture( _gl.TEXTURE_CUBE_MAP, this.cache.get("webgl_texture") );

            this.beforeUpdate( _gl );

            var glFormat = _gl[ this.format.toUpperCase() ],
                glType = _gl[ this.type.toUpperCase() ];

            _gl.texParameteri( _gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_WRAP_S, _gl[ this.wrapS.toUpperCase() ] );
            _gl.texParameteri( _gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_WRAP_T, _gl[ this.wrapT.toUpperCase() ] );

            _gl.texParameteri( _gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_MAG_FILTER, _gl[ this.magFilter.toUpperCase() ] );
            _gl.texParameteri( _gl.TEXTURE_CUBE_MAP, _gl.TEXTURE_MIN_FILTER, _gl[ this.minFilter.toUpperCase() ] );
            
            var anisotropicExt = WebGLInfo.getExtension("EXT_texture_filter_anisotropic");
            if( anisotropicExt){
                _gl.texParameterf(_gl.TEXTURE_CUBE_MAP, anisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic);
            }

            _.each( this.image, function(img, target){
                if( img )
                    _gl.texImage2D( _gl[ targetMap[target] ], 0, glFormat, glFormat, glType, img );
                else
                    _gl.texImage2D( _gl[ targetMap[target] ], 0, glFormat, this.width, this.height, 0, glFormat, glType, this.pixels[target] );
            }, this);

            if( !this.NPOT && this.generateMipmaps ){
                _gl.generateMipmap( _gl.TEXTURE_CUBE_MAP );
            }

            _gl.bindTexture( _gl.TEXTURE_CUBE_MAP, null );
        },
        bind : function( _gl ){

            _gl.bindTexture( _gl.TEXTURE_CUBE_MAP, this.getWebGLTexture(_gl) );
        },
        unbind : function( _gl ){
            _gl.bindTexture( _gl.TEXTURE_CUBE_MAP, null );
        },
        // Overwrite the isPowerOfTwo method
        isPowerOfTwo : function(){
            if( this.image.px ){
                return isPowerOfTwo( this.image.px.width ) &&
                        isPowerOfTwo( this.image.px.height );
            }else{
                return isPowerOfTwo( this.width ) &&
                        isPowerOfTwo( this.height );
            }

            function isPowerOfTwo( value ){
                return value & (value-1) === 0
            }
        },
        isRenderable : function(){
            if( this.image.px ){
                return this.image.px.complete &&
                        this.image.nx.complete &&
                        this.image.py.complete &&
                        this.image.ny.complete &&
                        this.image.pz.complete &&
                        this.image.nz.complete;
            }else{
                return this.width && this.height;
            }
        }
    });

    return TextureCube;
} );
define('3d/material',['require','core/base','./shader','util/util','./texture','./texture/texture2d','./texture/texturecube','_'], function(require){

    var Base = require("core/base");
    var Shader = require("./shader");
    var util = require("util/util");
    var Texture = require('./texture');
    var Texture2D = require('./texture/texture2d');
    var TextureCube = require('./texture/texturecube');
    var _ = require("_");

    var Material = Base.derive( function(){

        var id = util.genGUID();

        return {
            __GUID__ : id,

            name : 'MATERIAL_' + id,

            //{
            // type
            // value
            // semantic
            //}
            uniforms : {},

            shader : null,

            
            depthTest : true,
            depthWrite : true,

            transparent : false,
            // Blend func is a callback function when the material 
            // have custom blending
            // The gl context will be the only argument passed in tho the
            // blend function
            // Detail of blend function in WebGL:
            // http://www.khronos.org/registry/gles/specs/2.0/es_full_spec_2.0.25.pdf
            //
            // Example :
            // function( _gl ){
            //  _gl.blendEquation( _gl.FUNC_ADD );
            //  _gl.blendFunc( _gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA);
            // }
            blend : null,

            // Binding lights in the renderer automatically
            autoBindingLights : true
        }
    }, function(){
        if( this.shader ){
            this.attachShader( this.shader );
        }
    }, {

        bind : function( _gl ){

            var slot = 0;

            // Set uniforms
            _.each( this.uniforms, function( uniform, symbol ){
                // Only set the none-semantic uniform
                // The semantic uniform will be set by system
                if( uniform.semantic ){
                    return;
                }
                if( uniform.value === null ){
                    return;
                }
                else if(uniform.value instanceof Array
                    && ! uniform.value.length){
                    return;
                }
                if( uniform.value.instanceof &&
                    uniform.value.instanceof( Texture) ){
                
                    var texture = uniform.value;
                    // Maybe texture is not loaded yet;
                    if( ! texture.isRenderable() ){
                        return;
                    }

                    _gl.activeTexture( _gl.TEXTURE0 + slot );
                    texture.bind( _gl );

                    this.shader.setUniform( _gl, '1i', symbol, slot );

                    slot++;
                }
                else if( uniform.value instanceof Array ){
                    // Texture Array
                    var exampleValue = uniform.value[0];

                    if( exampleValue && 
                        exampleValue.instanceof && 
                        exampleValue.instanceof(Texture) ){

                        var res = [];
                        for( var i = 0; i < uniform.value.length; i++){
                            var texture = uniform.value[i];
                            // Maybe texture is not loaded yet;
                            if( ! texture.isRenderable() ){
                                continue;
                            }

                            _gl.activeTexture( _gl.TEXTURE0 + slot );
                            texture.bind(_gl);

                            res.push(slot++);
                        }
                        this.shader.setUniform( _gl, '1iv', symbol, res );

                    }else{
                        this.shader.setUniform( _gl, uniform.type, symbol, uniform.value );
                    }
                }
                else{
                    
                    this.shader.setUniform( _gl, uniform.type, symbol, uniform.value );
                }

            }, this );
        },

        setUniform : function( symbol, value ){
            var uniform = this.uniforms[symbol];
            if( uniform ){
                uniform.value = value;
            }else{
                // console.warn('Uniform "'+symbol+'" not exist');
            }
        },

        setUniforms : function(obj){
            for( var symbol in obj){
                var value = obj[symbol];
                this.setUniform( symbol, value );
            }
        },

        getUniform : function(symbol){
            var uniform = this.uniforms[symbol];
            if( uniform ){
                return uniform.value;
            }else{
                // console.warn('Uniform '+symbol+' not exist');
            }
        },

        attachShader : function( shader ){
            this.uniforms = shader.createUniforms();
            this.shader = shader;
        },

        detachShader : function(){
            this.shader = null;
            this.uniforms = {};
        }

    })

    return Material;
} );
define('3d/mesh',['require','./node','_'], function(require){

    var Node = require("./node");
    var _ = require("_");

    var prevDrawID = 0;

    var Mesh = Node.derive( function() {

        return {
            
            material : null,

            geometry : null,

            // Draw mode
            mode : "TRIANGLES",
            
            receiveShadow : true,
            castShadow : true,

            // Skinned Mesh
            skeleton : null
        }
    }, {

        render : function( renderer, globalMaterial ) {

            var _gl = renderer.gl;

            this.trigger('beforerender', _gl);
            
            var material = globalMaterial || this.material;
            var shader = material.shader;
            var geometry = this.geometry;

            var glDrawMode = _gl[ this.mode.toUpperCase() ];
            
            // Set pose matrices of skinned mesh
            if(this.skeleton){
                var skinMatricesArray = this.skeleton.getBoneMatricesArray();
                shader.setUniform(_gl, "m4v", "boneMatrices", skinMatricesArray);
            }
            // Draw each chunk
            var chunks = geometry.getBufferChunks( _gl );

            for( var c = 0; c < chunks.length; c++){
                currentDrawID = _gl.__GUID__ + "_" + geometry.__GUID__ + "_" + c;

                var chunk = chunks[c],
                    attributeBuffers = chunk.attributeBuffers,
                    indicesBuffer = chunk.indicesBuffer;

                if( currentDrawID !== prevDrawID ){
                    prevDrawID = currentDrawID;
                    
                    availableAttributes = {};
                    for(var name in attributeBuffers){
                        var attributeBufferInfo = attributeBuffers[name];
                        var semantic = attributeBufferInfo.semantic;

                        if( semantic ){
                            var semanticInfo = shader.semantics[ semantic ];
                            var symbol = semanticInfo && semanticInfo.symbol;
                        }else{
                            var symbol = name;
                        }
                        if(symbol && shader.attributeTemplates[symbol] ){
                            availableAttributes[symbol] = attributeBufferInfo;
                        }
                    }
                    shader.enableAttributes(_gl, Object.keys(availableAttributes) );
                    // Setting attributes;
                    for( var symbol in availableAttributes ){
                        var attributeBufferInfo = availableAttributes[symbol];
                        var buffer = attributeBufferInfo.buffer;

                        _gl.bindBuffer( _gl.ARRAY_BUFFER, buffer );
                        shader.setMeshAttribute( _gl, symbol, attributeBufferInfo );
                    }
                }
                //Do drawing
                if( geometry.useFaces ){
                    _gl.bindBuffer( _gl.ELEMENT_ARRAY_BUFFER, indicesBuffer.buffer );
                    _gl.drawElements( glDrawMode, indicesBuffer.count, _gl.UNSIGNED_SHORT, 0 );
                }else{
                    _gl.drawArrays( glDrawMode, 0, geometry.vertexCount );
                }
            }

            var drawInfo = {
                faceNumber : geometry.faces.length,
                vertexNumber : geometry.getVerticesNumber(),
                drawcallNumber : chunks.length
            };
            this.trigger('afterrender', _gl, drawInfo);

            return drawInfo;
        },

        bindGeometry : function( _gl ) {

            var shader = this.material.shader;
            var geometry = this.geometry;

        }

    });

    // Called when material is changed
    // In case the material changed and geometry not changed
    // And the previous material has less attributes than next material
    Mesh.materialChanged = function(){
        prevDrawID = 0;
    }

    return Mesh;
} );
/**
 * @license RequireJS text 2.0.5 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/requirejs/text for details
 */
/*jslint regexp: true */
/*global require: false, XMLHttpRequest: false, ActiveXObject: false,
  define: false, window: false, process: false, Packages: false,
  java: false, location: false */

define('text',['module'], function (module) {
    
    
    var text, fs,
        progIds = ['Msxml2.XMLHTTP', 'Microsoft.XMLHTTP', 'Msxml2.XMLHTTP.4.0'],
        xmlRegExp = /^\s*<\?xml(\s)+version=[\'\"](\d)*.(\d)*[\'\"](\s)*\?>/im,
        bodyRegExp = /<body[^>]*>\s*([\s\S]+)\s*<\/body>/im,
        hasLocation = typeof location !== 'undefined' && location.href,
        defaultProtocol = hasLocation && location.protocol && location.protocol.replace(/\:/, ''),
        defaultHostName = hasLocation && location.hostname,
        defaultPort = hasLocation && (location.port || undefined),
        buildMap = [],
        masterConfig = (module.config && module.config()) || {};

    text = {
        version: '2.0.5',

        strip: function (content) {
            //Strips <?xml ...?> declarations so that external SVG and XML
            //documents can be added to a document without worry. Also, if the string
            //is an HTML document, only the part inside the body tag is returned.
            if (content) {
                content = content.replace(xmlRegExp, "");
                var matches = content.match(bodyRegExp);
                if (matches) {
                    content = matches[1];
                }
            } else {
                content = "";
            }
            return content;
        },

        jsEscape: function (content) {
            return content.replace(/(['\\])/g, '\\$1')
                .replace(/[\f]/g, "\\f")
                .replace(/[\b]/g, "\\b")
                .replace(/[\n]/g, "\\n")
                .replace(/[\t]/g, "\\t")
                .replace(/[\r]/g, "\\r")
                .replace(/[\u2028]/g, "\\u2028")
                .replace(/[\u2029]/g, "\\u2029");
        },

        createXhr: masterConfig.createXhr || function () {
            //Would love to dump the ActiveX crap in here. Need IE 6 to die first.
            var xhr, i, progId;
            if (typeof XMLHttpRequest !== "undefined") {
                return new XMLHttpRequest();
            } else if (typeof ActiveXObject !== "undefined") {
                for (i = 0; i < 3; i += 1) {
                    progId = progIds[i];
                    try {
                        xhr = new ActiveXObject(progId);
                    } catch (e) {}

                    if (xhr) {
                        progIds = [progId];  // so faster next time
                        break;
                    }
                }
            }

            return xhr;
        },

        /**
         * Parses a resource name into its component parts. Resource names
         * look like: module/name.ext!strip, where the !strip part is
         * optional.
         * @param {String} name the resource name
         * @returns {Object} with properties "moduleName", "ext" and "strip"
         * where strip is a boolean.
         */
        parseName: function (name) {
            var modName, ext, temp,
                strip = false,
                index = name.indexOf("."),
                isRelative = name.indexOf('./') === 0 ||
                             name.indexOf('../') === 0;

            if (index !== -1 && (!isRelative || index > 1)) {
                modName = name.substring(0, index);
                ext = name.substring(index + 1, name.length);
            } else {
                modName = name;
            }

            temp = ext || modName;
            index = temp.indexOf("!");
            if (index !== -1) {
                //Pull off the strip arg.
                strip = temp.substring(index + 1) === "strip";
                temp = temp.substring(0, index);
                if (ext) {
                    ext = temp;
                } else {
                    modName = temp;
                }
            }

            return {
                moduleName: modName,
                ext: ext,
                strip: strip
            };
        },

        xdRegExp: /^((\w+)\:)?\/\/([^\/\\]+)/,

        /**
         * Is an URL on another domain. Only works for browser use, returns
         * false in non-browser environments. Only used to know if an
         * optimized .js version of a text resource should be loaded
         * instead.
         * @param {String} url
         * @returns Boolean
         */
        useXhr: function (url, protocol, hostname, port) {
            var uProtocol, uHostName, uPort,
                match = text.xdRegExp.exec(url);
            if (!match) {
                return true;
            }
            uProtocol = match[2];
            uHostName = match[3];

            uHostName = uHostName.split(':');
            uPort = uHostName[1];
            uHostName = uHostName[0];

            return (!uProtocol || uProtocol === protocol) &&
                   (!uHostName || uHostName.toLowerCase() === hostname.toLowerCase()) &&
                   ((!uPort && !uHostName) || uPort === port);
        },

        finishLoad: function (name, strip, content, onLoad) {
            content = strip ? text.strip(content) : content;
            if (masterConfig.isBuild) {
                buildMap[name] = content;
            }
            onLoad(content);
        },

        load: function (name, req, onLoad, config) {
            //Name has format: some.module.filext!strip
            //The strip part is optional.
            //if strip is present, then that means only get the string contents
            //inside a body tag in an HTML string. For XML/SVG content it means
            //removing the <?xml ...?> declarations so the content can be inserted
            //into the current doc without problems.

            // Do not bother with the work if a build and text will
            // not be inlined.
            if (config.isBuild && !config.inlineText) {
                onLoad();
                return;
            }

            masterConfig.isBuild = config.isBuild;

            var parsed = text.parseName(name),
                nonStripName = parsed.moduleName +
                    (parsed.ext ? '.' + parsed.ext : ''),
                url = req.toUrl(nonStripName),
                useXhr = (masterConfig.useXhr) ||
                         text.useXhr;

            //Load the text. Use XHR if possible and in a browser.
            if (!hasLocation || useXhr(url, defaultProtocol, defaultHostName, defaultPort)) {
                text.get(url, function (content) {
                    text.finishLoad(name, parsed.strip, content, onLoad);
                }, function (err) {
                    if (onLoad.error) {
                        onLoad.error(err);
                    }
                });
            } else {
                //Need to fetch the resource across domains. Assume
                //the resource has been optimized into a JS module. Fetch
                //by the module name + extension, but do not include the
                //!strip part to avoid file system issues.
                req([nonStripName], function (content) {
                    text.finishLoad(parsed.moduleName + '.' + parsed.ext,
                                    parsed.strip, content, onLoad);
                });
            }
        },

        write: function (pluginName, moduleName, write, config) {
            if (buildMap.hasOwnProperty(moduleName)) {
                var content = text.jsEscape(buildMap[moduleName]);
                write.asModule(pluginName + "!" + moduleName,
                               "define(function () { return '" +
                                   content +
                               "';});\n");
            }
        },

        writeFile: function (pluginName, moduleName, req, write, config) {
            var parsed = text.parseName(moduleName),
                extPart = parsed.ext ? '.' + parsed.ext : '',
                nonStripName = parsed.moduleName + extPart,
                //Use a '.js' file name so that it indicates it is a
                //script that can be loaded across domains.
                fileName = req.toUrl(parsed.moduleName + extPart) + '.js';

            //Leverage own load() method to load plugin value, but only
            //write out values that do not have the strip argument,
            //to avoid any potential issues with ! in file names.
            text.load(nonStripName, req, function (value) {
                //Use own write() method to construct full module value.
                //But need to create shell that translates writeFile's
                //write() to the right interface.
                var textWrite = function (contents) {
                    return write(fileName, contents);
                };
                textWrite.asModule = function (moduleName, contents) {
                    return write.asModule(moduleName, fileName, contents);
                };

                text.write(pluginName, nonStripName, textWrite, config);
            }, config);
        }
    };

    if (masterConfig.env === 'node' || (!masterConfig.env &&
            typeof process !== "undefined" &&
            process.versions &&
            !!process.versions.node)) {
        //Using special require.nodeRequire, something added by r.js.
        fs = require.nodeRequire('fs');

        text.get = function (url, callback) {
            var file = fs.readFileSync(url, 'utf8');
            //Remove BOM (Byte Mark Order) from utf8 files if it is there.
            if (file.indexOf('\uFEFF') === 0) {
                file = file.substring(1);
            }
            callback(file);
        };
    } else if (masterConfig.env === 'xhr' || (!masterConfig.env &&
            text.createXhr())) {
        text.get = function (url, callback, errback, headers) {
            var xhr = text.createXhr(), header;
            xhr.open('GET', url, true);

            //Allow plugins direct access to xhr headers
            if (headers) {
                for (header in headers) {
                    if (headers.hasOwnProperty(header)) {
                        xhr.setRequestHeader(header.toLowerCase(), headers[header]);
                    }
                }
            }

            //Allow overrides specified in config
            if (masterConfig.onXhr) {
                masterConfig.onXhr(xhr, url);
            }

            xhr.onreadystatechange = function (evt) {
                var status, err;
                //Do not explicitly handle errors, those should be
                //visible via console output in the browser.
                if (xhr.readyState === 4) {
                    status = xhr.status;
                    if (status > 399 && status < 600) {
                        //An http 4xx or 5xx error. Signal an error.
                        err = new Error(url + ' HTTP status: ' + status);
                        err.xhr = xhr;
                        errback(err);
                    } else {
                        callback(xhr.responseText);
                    }
                }
            };
            xhr.send(null);
        };
    } else if (masterConfig.env === 'rhino' || (!masterConfig.env &&
            typeof Packages !== 'undefined' && typeof java !== 'undefined')) {
        //Why Java, why is this so awkward?
        text.get = function (url, callback) {
            var stringBuffer, line,
                encoding = "utf-8",
                file = new java.io.File(url),
                lineSeparator = java.lang.System.getProperty("line.separator"),
                input = new java.io.BufferedReader(new java.io.InputStreamReader(new java.io.FileInputStream(file), encoding)),
                content = '';
            try {
                stringBuffer = new java.lang.StringBuffer();
                line = input.readLine();

                // Byte Order Mark (BOM) - The Unicode Standard, version 3.0, page 324
                // http://www.unicode.org/faq/utf_bom.html

                // Note that when we use utf-8, the BOM should appear as "EF BB BF", but it doesn't due to this bug in the JDK:
                // http://bugs.sun.com/bugdatabase/view_bug.do?bug_id=4508058
                if (line && line.length() && line.charAt(0) === 0xfeff) {
                    // Eat the BOM, since we've already found the encoding on this file,
                    // and we plan to concatenating this buffer with others; the BOM should
                    // only appear at the top of a file.
                    line = line.substring(1);
                }

                stringBuffer.append(line);

                while ((line = input.readLine()) !== null) {
                    stringBuffer.append(lineSeparator);
                    stringBuffer.append(line);
                }
                //Make sure we return a JavaScript string and not a Java string.
                content = String(stringBuffer.toString()); //String
            } finally {
                input.close();
            }
            callback(content);
        };
    }

    return text;
});

define('text!3d/compositor/shaders/vertex.essl',[],function () { return 'uniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\n\nvarying vec2 v_Texcoord;\n\nvoid main(){\n\n    v_Texcoord = texcoord;\n    gl_Position = worldViewProjection * vec4(position, 1.0);\n}';});

define('text!3d/compositor/shaders/coloradjust.essl',[],function () { return '@export buildin.compositor.coloradjust\n\nvarying vec2 v_Texcoord;\nuniform sampler2D texture;\n\nuniform float brightness : 0.0;\nuniform float contrast : 1.0;\nuniform float exposure : 0.0;\nuniform float gamma : 1.0;\nuniform float saturation : 1.0;\n\n// Values from "Graphics Shaders: Theory and Practice" by Bailey and Cunningham\nconst vec3 w = vec3(0.2125, 0.7154, 0.0721);\n\nvoid main()\n{\n    vec4 tex = texture2D( texture, v_Texcoord);\n\n    // brightness\n    gl_FragColor.xyz = tex.rgb + vec3(brightness);\n    // contrast\n    gl_FragColor.xyz = (gl_FragColor.xyz-vec3(0.5))*contrast+vec3(0.5);\n    // exposure\n    gl_FragColor.xyz = gl_FragColor.xyz * pow(2.0, exposure);\n    // gamma\n    gl_FragColor.xyz = pow(gl_FragColor.xyz, vec3(gamma));\n    // saturation\n    float luminance = dot( gl_FragColor.xyz, w );\n    gl_FragColor.xyz = mix(vec3(luminance), gl_FragColor.xyz, saturation);\n\n    gl_FragColor.w = tex.w;\n}\n\n@end';});

define('text!3d/compositor/shaders/blur.essl',[],function () { return '/**\n *  http://www.gamerendering.com/2008/10/11/gaussian-blur-filter-shader/\n */\n\n@export buildin.compositor.gaussian_blur_v\n\nuniform sampler2D texture; // the texture with the scene you want to blur\nvarying vec2 v_Texcoord;\n \nuniform float blurSize : 3.0; \nuniform float imageWidth : 512.0;\n\nvoid main(void)\n{\n   vec4 sum = vec4(0.0);\n \n   // blur in y (vertical)\n   // take nine samples, with the distance blurSize between them\n   sum += texture2D(texture, vec2(v_Texcoord.x - 4.0*blurSize/imageWidth, v_Texcoord.y)) * 0.05;\n   sum += texture2D(texture, vec2(v_Texcoord.x - 3.0*blurSize/imageWidth, v_Texcoord.y)) * 0.09;\n   sum += texture2D(texture, vec2(v_Texcoord.x - 2.0*blurSize/imageWidth, v_Texcoord.y)) * 0.12;\n   sum += texture2D(texture, vec2(v_Texcoord.x - blurSize/imageWidth, v_Texcoord.y)) * 0.15;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y)) * 0.16;\n   sum += texture2D(texture, vec2(v_Texcoord.x + blurSize/imageWidth, v_Texcoord.y)) * 0.15;\n   sum += texture2D(texture, vec2(v_Texcoord.x + 2.0*blurSize/imageWidth, v_Texcoord.y)) * 0.12;\n   sum += texture2D(texture, vec2(v_Texcoord.x + 3.0*blurSize/imageWidth, v_Texcoord.y)) * 0.09;\n   sum += texture2D(texture, vec2(v_Texcoord.x + 4.0*blurSize/imageWidth, v_Texcoord.y)) * 0.05;\n \n   gl_FragColor = sum;\n}\n\n@end\n\n@export buildin.compositor.gaussian_blur_h\n\nuniform sampler2D texture; // this should hold the texture rendered by the horizontal blur pass\nvarying vec2 v_Texcoord;\n \nuniform float blurSize : 3.0;\nuniform float imageHeight : 512.0;\n \nvoid main(void)\n{\n   vec4 sum = vec4(0.0);\n \n   // blur in y (vertical)\n   // take nine samples, with the distance blurSize between them\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y - 4.0*blurSize/imageHeight)) * 0.05;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y - 3.0*blurSize/imageHeight)) * 0.09;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y - 2.0*blurSize/imageHeight)) * 0.12;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y - blurSize/imageHeight)) * 0.15;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y)) * 0.16;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y + blurSize/imageHeight)) * 0.15;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y + 2.0*blurSize/imageHeight)) * 0.12;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y + 3.0*blurSize/imageHeight)) * 0.09;\n   sum += texture2D(texture, vec2(v_Texcoord.x, v_Texcoord.y + 4.0*blurSize/imageHeight)) * 0.05;\n \n   gl_FragColor = sum;\n}\n\n@end\n\n@export buildin.compositor.box_blur\n\nuniform sampler2D texture;\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 3.0;\nuniform float imageWidth : 512.0;\nuniform float imageHeight : 512.0;\n\nvoid main(void){\n\n   vec4 tex = texture2D(texture, v_Texcoord);\n   float offsetX = blurSize / imageWidth;\n   float offsetY = blurSize / imageHeight;\n   tex += texture2D(texture, v_Texcoord + vec2(offsetX, 0.0) );\n   tex += texture2D(texture, v_Texcoord + vec2(offsetX, offsetY) );\n   tex += texture2D(texture, v_Texcoord + vec2(-offsetX, offsetY) );\n   tex += texture2D(texture, v_Texcoord + vec2(0.0, offsetY) );\n   tex += texture2D(texture, v_Texcoord + vec2(-offsetX, 0.0) );\n   tex += texture2D(texture, v_Texcoord + vec2(-offsetX, -offsetY) );\n   tex += texture2D(texture, v_Texcoord + vec2(offsetX, -offsetY) );\n   tex += texture2D(texture, v_Texcoord + vec2(0.0, -offsetY) );\n\n   tex /= 9.0;\n   return tex;\n}\n\n@end\n\n// http://www.slideshare.net/DICEStudio/five-rendering-ideas-from-battlefield-3-need-for-speed-the-run\n@export buildin.compositor.hexagonal_blur_mrt_1\n\n// MRT in chrome\n// https://www.khronos.org/registry/webgl/sdk/tests/conformance/extensions/ext-draw-buffers.html\n#extension GL_EXT_draw_buffers : require\n\nuniform sampler2D texture;\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 2.0;\n\nuniform float imageWidth : 512.0;\nuniform float imageHeight : 512.0;\n\nvoid main(void){\n   float offsetY = blurSize / imageHeight;\n   float offsetX = blurSize / imageWidth;\n\n   vec4 color = vec4(0.0);\n   // Top\n   for(int i = 0; i < 10; i++){\n      color += 1.0/10.0 * texture2D(texture, v_Texcoord + vec2(0.0, offsetY * float(i)) );\n   }\n   gl_FragData[0] = color;\n   // Down left\n   for(int i = 0; i < 10; i++){\n      color += 1.0/10.0 * texture2D(texture, v_Texcoord - vec2(offsetX * float(i), offsetY * float(i)) );\n   }\n   gl_FragData[1] = color;\n}\n\n@end\n\n@export buildin.compositor.hexagonal_blur_mrt_2\n\nuniform sampler2D texture0;\nuniform sampler2D texture1;\n\nvarying vec2 v_Texcoord;\n\nuniform float blurSize : 2.0;\n\nuniform float imageWidth : 512.0;\nuniform float imageHeight : 512.0;\n\nvoid main(void){\n   float offsetY = blurSize / imageHeight;\n   float offsetX = blurSize / imageWidth;\n\n   vec4 color1 = vec4(0.0);\n   // Down left\n   for(int i = 0; i < 10; i++){\n      color1 += 1.0/10.0 * texture2D(texture0, v_Texcoord - vec2(offsetX * float(i), offsetY * float(i)) );\n   }\n   vec4 color2 = vec4(0.0);\n   // Down right\n   for(int i = 0; i < 10; i++){\n      color2 += 1.0/10.0 * texture2D(texture1, v_Texcoord + vec2(offsetX * float(i), -offsetY * float(i)) );\n   }\n\n   gl_FragColor = (color1 + color2) / 2.0;\n}\n\n@end';});

define('text!3d/compositor/shaders/grayscale.essl',[],function () { return '\n@export buildin.compositor.grayscale\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\n\nconst vec3 w = vec3(0.2125, 0.7154, 0.0721);\n\nvoid main()\n{\n    vec4 tex = texture2D( texture, v_Texcoord );\n    float luminance = dot(tex.rgb, w);\n\n    gl_FragColor = vec4(vec3(luminance), tex.a);\n}\n\n@end';});

define('text!3d/compositor/shaders/lut.essl',[],function () { return '\n// https://github.com/BradLarson/GPUImage?source=c\n@export buildin.compositor.lut\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\nuniform sampler2D lookup;\n\nvoid main()\n{\n    vec4 tex = texture2D(texture, v_Texcoord);\n\n    float blueColor = tex.b * 63.0;\n    \n    vec2 quad1;\n    quad1.y = floor(floor(blueColor) / 8.0);\n    quad1.x = floor(blueColor) - (quad1.y * 8.0);\n    \n    vec2 quad2;\n    quad2.y = floor(ceil(blueColor) / 8.0);\n    quad2.x = ceil(blueColor) - (quad2.y * 8.0);\n    \n    vec2 texPos1;\n    texPos1.x = (quad1.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * tex.r);\n    texPos1.y = (quad1.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * tex.g);\n    \n    vec2 texPos2;\n    texPos2.x = (quad2.x * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * tex.r);\n    texPos2.y = (quad2.y * 0.125) + 0.5/512.0 + ((0.125 - 1.0/512.0) * tex.g);\n    \n    vec4 newColor1 = texture2D(lookup, texPos1);\n    vec4 newColor2 = texture2D(lookup, texPos2);\n    \n    vec4 newColor = mix(newColor1, newColor2, fract(blueColor));\n    gl_FragColor = vec4(newColor.rgb, tex.w);\n}\n\n@end';});

define('text!3d/compositor/shaders/output.essl',[],function () { return '\n@export buildin.compositor.output\n\nvarying vec2 v_Texcoord;\n\nuniform sampler2D texture;\n\nvoid main()\n{\n    vec4 tex = texture2D( texture, v_Texcoord );\n\n    gl_FragColor = tex;\n}\n\n@end';});

define('3d/compositor/pass',['require','core/base','../scene','../camera/orthographic','../geometry/plane','../shader','../material','../mesh','../scene','text!./shaders/vertex.essl','../texture','../webglinfo','text!./shaders/coloradjust.essl','text!./shaders/blur.essl','text!./shaders/grayscale.essl','text!./shaders/lut.essl','text!./shaders/output.essl'], function(require){

    var Base = require("core/base");
    var Scene = require("../scene");
    var OrthoCamera = require('../camera/orthographic');
    var Plane = require('../geometry/plane');
    var Shader = require('../shader');
    var Material = require('../material');
    var Mesh = require('../mesh');
    var Scene = require('../scene');
    var vertexShaderString = require("text!./shaders/vertex.essl");
    var Texture = require('../texture');
    var WebGLInfo = require('../webglinfo');

    var planeGeo = new Plane();
    var mesh = new Mesh({
            geometry : planeGeo
        });
    var scene = new Scene();
    var camera = new OrthoCamera();
        
    scene.add(mesh);

    var Pass = Base.derive( function(){
        return {
            // Fragment shader string
            fragment : "",

            outputs : null,

            _material : null

        }
    }, function(){

        var shader = new Shader({
            vertex : vertexShaderString,
            fragment : this.fragment
        })
        var material = new Material({
            shader : shader
        });
        shader.enableTexturesAll();

        this._material = material;

    }, {

        setUniform : function(name, value){
            
            var uniform = this._material.uniforms[name];
            if( uniform ){
                uniform.value = value;
            }else{
                // console.warn('Unkown uniform "' + name + '"');
            }
        },

        bind : function( renderer, frameBuffer ){
            
            if( this.outputs ){
                for( var attachment in this.outputs){
                    var texture = this.outputs[attachment];
                    frameBuffer.attach( renderer.gl, texture, attachment );
                }
                frameBuffer.bind( renderer );
            }
        },

        unbind : function( renderer, frameBuffer ){
            frameBuffer.unbind( renderer );
        },

        render : function( renderer, frameBuffer ){

            var _gl = renderer.gl;

            mesh.material = this._material;

            if( frameBuffer ){
                this.bind( renderer, frameBuffer );
            }

            // MRT Support in chrome
            // https://www.khronos.org/registry/webgl/sdk/tests/conformance/extensions/ext-draw-buffers.html
            var ext = WebGLInfo.getExtension("EXT_draw_buffers");
            if(ext){
                var bufs = [];
                for( var attachment in this.outputs){
                    attachment = parseInt(attachment);
                    if(attachment >= _gl.COLOR_ATTACHMENT0 && attachment <= _gl.COLOR_ATTACHMENT0 + 8){
                        bufs.push(attachment);
                    }
                }
                ext.drawBuffersEXT(bufs);
            }

            renderer.render( scene, camera, true );

            if( frameBuffer ){
                this.unbind( renderer, frameBuffer );
            }
        }
    } )

    // Some build in shaders
    Shader.import( require('text!./shaders/coloradjust.essl') );
    Shader.import( require('text!./shaders/blur.essl') );
    Shader.import( require('text!./shaders/grayscale.essl') );
    Shader.import( require('text!./shaders/lut.essl') );
    Shader.import( require('text!./shaders/output.essl') );

    return Pass;
} );
/**
 * @export{class} FrameBuffer
 */
define('3d/framebuffer',['require','core/base','./texture/texture2d','./texture/texturecube','./webglinfo'], function(require) {
    
    var Base = require("core/base");
    var Texture2D = require("./texture/texture2d");
    var TextureCube = require("./texture/texturecube");
    var WebGLInfo = require('./webglinfo');

    var FrameBuffer = Base.derive( function(){

        return {
            depthBuffer : true,

            //Save attached texture and target
            _attachedTextures : {}
        }
    }, {

        bind : function( renderer ){

            var _gl = renderer.gl;

            _gl.bindFramebuffer( _gl.FRAMEBUFFER, this.getFrameBuffer( _gl ) );

            this.cache.put( "viewport", renderer.viewportInfo );
            renderer.setViewport( 0, 0, this.cache.get('width'), this.cache.get('height') );

            // Create a new render buffer
            if( this.cache.miss("renderbuffer") && this.depthBuffer && ! this.cache.get("depth_texture") ){
                this.cache.put( "renderbuffer", _gl.createRenderbuffer() );
            }

            if( ! this.cache.get("depth_texture") && this.depthBuffer ){

                var width = this.cache.get("width"),
                    height = this.cache.get("height"),
                    renderbuffer = this.cache.get('renderbuffer');

                if( width !== this.cache.get("renderbuffer_width")
                     || height !== this.cache.get("renderbuffer_height") ){

                    _gl.bindRenderbuffer( _gl.RENDERBUFFER, renderbuffer );
                    
                    _gl.renderbufferStorage(_gl.RENDERBUFFER, _gl.DEPTH_COMPONENT16, width, height );
                    this.cache.put("renderbuffer_width", width);
                    this.cache.put("renderbuffer_height", height);

                    _gl.bindRenderbuffer( _gl.RENDERBUFFER, null );                 
                }
                if( ! this.cache.get("renderbuffer_attached") ){
                    
                    _gl.framebufferRenderbuffer( _gl.FRAMEBUFFER, _gl.DEPTH_ATTACHMENT, _gl.RENDERBUFFER, renderbuffer );
                    this.cache.put( "renderbuffer_attached", true );

                }
            }
            
        },

        unbind : function( renderer ){
            var _gl = renderer.gl;
            
            _gl.bindFramebuffer( _gl.FRAMEBUFFER, null );

            this.cache.use( _gl.__GUID__ );
            var viewportInfo = this.cache.get("viewport");
            // Reset viewport;
            if( viewportInfo ){
                renderer.setViewport( viewportInfo.x, viewportInfo.y, viewportInfo.width, viewportInfo.height );
            }

            // Because the data of texture is changed over time,
            // Here update the mipmaps of texture each time after rendered;
            for( var attachment in this._attachedTextures ){
                var texture = this._attachedTextures[attachment];
                if( ! texture.NPOT && texture.generateMipmaps ){
                    var target = texture.instanceof(TextureCube) ? _gl.TEXTURE_CUBE_MAP : _gl.TEXTURE_2D;
                    _gl.bindTexture( target, texture.getWebGLTexture( _gl ) );
                    _gl.generateMipmap( target );
                    _gl.bindTexture( target, null );
                }
            }
        },

        getFrameBuffer : function( _gl ){

            this.cache.use( _gl.__GUID__ );

            if( this.cache.miss("framebuffer") ){
                this.cache.put( "framebuffer", _gl.createFramebuffer() );
            }

            return this.cache.get("framebuffer");
        },

        attach : function( _gl, texture, attachment, target ){

            if( ! texture.width ){
                console.error("The texture attached to color buffer is not a valid.");
                return;
            }
            if( this._renderBuffer && this.depthBuffer && ( this._width !== texture.width || this.height !== texture.height) ){
                console.warn( "Attached texture has different width or height, it will cause the render buffer recreate a storage ");
            }

            _gl.bindFramebuffer( _gl.FRAMEBUFFER, this.getFrameBuffer( _gl ) );

            this.cache.put("width", texture.width);
            this.cache.put("height", texture.height);

            target = target || _gl.TEXTURE_2D;

            // If the depth_texture extension is enabled, developers
            // Can attach a depth texture to the depth buffer
            // http://blog.tojicode.com/2012/07/using-webgldepthtexture.html
            attachment = attachment || _gl.COLOR_ATTACHMENT0;
            
            if( attachment === 'DEPTH_ATTACHMENT' ){

                var extension = WebGLInfo.getExtension("WEBGL_depth_texture");

                if( !extension ){
                    console.error( " Depth texture is not supported by the browser ");
                    return;
                }
                if( texture.format !== "DEPTH_COMPONENT" ){
                    console.error("The texture attached to depth buffer is not a valid.");
                    return;
                }
                this.cache.put("renderbuffer_attached", false);
                this.cache.put("depth_texture", true);
            }

            this._attachedTextures[ attachment ] = texture;

            _gl.framebufferTexture2D( _gl.FRAMEBUFFER, attachment, target, texture.getWebGLTexture( _gl ), 0)

            _gl.bindFramebuffer( _gl.FRAMEBUFFER, null);
        },

        detach : function(){},

        dispose : function( _gl ){

            this.cache.use( _gl.__GUID__ );

            if( this.cache.get("renderbuffer") )
                _gl.deleteRenderbuffer( this.cache.get("renderbuffer") );
            if( this.cache.get("framebuffer") )
                _gl.deleteFramebuffer( this.cache.get("framebuffer") );

            this.cache.clearContext();

        }
    } )

    return FrameBuffer;
} );
define('3d/compositor/graph/texturepool',['require','../../texture/texture2d','_'], function(require){
    
    var Texture2D = require("../../texture/texture2d");
    var _ = require("_");

    var pool = {};

    var texturePool = {

        get : function( parameters ){
            var key = generateKey( parameters );
            if( ! pool.hasOwnProperty( key ) ){
                pool[key] = [];
            }
            var list = pool[key];
            if( ! list.length ){
                var texture = new Texture2D( parameters );
                return texture;
            }
            return list.pop();
        },

        put : function( texture ){
            var key = generateKey( texture );
            if( ! pool.hasOwnProperty( key ) ){
                pool[key] = [];
            }
            var list = pool[key];
            list.push( texture );
        }
    }

    function generateKey( parameters ){
        var defaultParams = {
            width : 512,
            height : 512,
            type : 'UNSIGNED_BYTE',
            format : "RGBA",
            wrapS : "CLAMP_TO_EDGE",
            wrapT : "CLAMP_TO_EDGE",
            minFilter : "LINEAR_MIPMAP_LINEAR",
            magFilter : "LINEAR",
            generateMipmaps : true,
            anisotropy : 1,
            flipY : true,
            unpackAlignment : 4,
            premultiplyAlpha : false
        }

        _.defaults(parameters, defaultParams);
        fallBack(parameters);

        var key = "";
        for(var name in defaultParams) {
            if( parameters[name] ){
                var chunk = parameters[name].toString();
            }else{
                var chunk = defaultParams[name].toString();
            }
            key += chunk;
        }
        return key;
    }

    function fallBack(target){

        var IPOT = isPowerOfTwo(target.width, target.height);

        if( target.format === "DEPTH_COMPONENT"){
            target.generateMipmaps = false;
        }

        if( ! IPOT || ! target.generateMipmaps){
            if( target.minFilter.indexOf("NEAREST") == 0){
                target.minFilter = 'NEAREST';
            }else{
                target.minFilter = 'LINEAR'
            }

            if( target.magFilter.indexOf("NEAREST") == 0){
                target.magFilter = 'NEAREST';
            }else{
                target.magFilter = 'LINEAR'
            }
            target.wrapS = 'CLAMP_TO_EDGE';
            target.wrapT = 'CLAMP_TO_EDGE';
        }
    }

    function isPowerOfTwo(width, height){
        return ( width & (width-1) ) === 0 &&
                ( height & (height-1) ) === 0;
    }

    return texturePool
} );
/**
 * Example
 * {
 *  name : "xxx",
    shader : shader,
 *  inputs :{ 
                "texture" : {
                    node : "xxx",
                    pin : "diffuse"
                }
             }
    outputs : {
                diffuse : {
                    attachment : "COLOR_ATTACHMENT0"
                    parameters : {
                        format : "RGBA",
                        width : 512,
                        height : 512
                    }
                }
            }

   }
 * Multiple outputs is reserved for MRT support
 *
 * TODO blending 
 */
define('3d/compositor/graph/node',['require','core/base','../pass','../../framebuffer','text!../shaders/vertex.essl','../../shader','./texturepool'], function( require ){

    var Base = require("core/base");
    var Pass = require("../pass");
    var FrameBuffer = require("../../framebuffer");
    var vertexShaderStr = require("text!../shaders/vertex.essl");
    var Shader = require("../../shader");
    var texturePool = require("./texturepool");

    var Node = Base.derive( function(){
        return {

            name : "",

            inputs : {},
            
            outputs : null,

            shader : '',
            // Example:
            // inputName : {
            //  node : [Node],
            //  pin : 'xxxx'    
            // }
            _inputLinks : {},
            // Example:
            // outputName : [{
            //  node : [Node],
            //  pin : 'xxxx'    
            // }]
            _outputLinks : {},

            _textures : {},

            pass : null,

            //{
            //  name : 2
            //}
            _outputReferences : {}
        }
    }, function(){
        if( this.shader ){
            var pass = new Pass({
                fragment : this.shader
            });
            this.pass = pass;   
        }
        if(this.outputs){
            this.frameBuffer = new FrameBuffer({
                depthBuffer : false
            })
        }
    }, {

        render : function( renderer ){
            var _gl = renderer.gl;
            for( var inputName in this._inputLinks ){
                var link = this._inputLinks[inputName];
                var inputTexture = link.node.getOutput( renderer, link.pin );
                this.pass.setUniform( inputName, inputTexture );
            }
            // Output
            if( ! this.outputs){
                this.pass.outputs = null;
                this.pass.render( renderer );
            }
            else{
                this.pass.outputs = {};

                for( var name in this.outputs){

                    var outputInfo = this.outputs[name];

                    var texture = texturePool.get( outputInfo.parameters );
                    this._textures[name] = texture;

                    var attachment = outputInfo.attachment || _gl.COLOR_ATTACHMENT0;
                    if(typeof(attachment) == "string"){
                        attachment = _gl[attachment];
                    }
                    this.pass.outputs[ attachment ] = texture;

                }

                this.pass.render( renderer, this.frameBuffer );
            }
            
            for( var inputName in this._inputLinks ){
                var link = this._inputLinks[inputName];
                link.node.removeReference( link.pin );
            }
        },

        setParameter : function( name, value ){
            this.pass.setUniform( name, value );
        },

        setParameters : function(obj){
            for(var name in obj){
                this.setParameter(name, obj[name]);
            }
        },

        getOutput : function( renderer, name ){
            var outputInfo = this.outputs[name];
            if( ! outputInfo){
                return ;
            }
            if( this._textures[name] ){
                // Already been rendered in this frame
                return this._textures[name];
            }

            this.render( renderer );
            
            return this._textures[name];
        },

        removeReference : function( name ){
            this._outputReferences[name]--;
            if( this._outputReferences[name] === 0){
                // Output of this node have alreay been used by all other nodes
                // Put the texture back to the pool.
                texturePool.put( this._textures[name] );
                this._textures[name] = null;
            }
        },

        link : function( inputPinName, fromNode, fromPinName){

            // The relationship from output pin to input pin is one-on-multiple
            this._inputLinks[ inputPinName ] = {
                node : fromNode,
                pin : fromPinName
            }
            if( ! fromNode._outputLinks[ fromPinName ] ){
                fromNode._outputLinks[ fromPinName ] = [];
            }
            fromNode._outputLinks[ fromPinName ].push( {
                node : this,
                pin : inputPinName
            } )
        },

        clear : function(){
            this._inputLinks = {};
            this._outputLinks = {};
        },

        updateReference : function( ){
            for( var name in this._outputLinks ){
                this._outputReferences[ name ] = this._outputLinks[name].length;
            }
        }
    })

    return Node;
});
/**
 * @export{class} SceneNode
 */
define('3d/compositor/graph/scenenode',['require','./node','../pass','../../framebuffer','./texturepool'], function( require ){

    var Node = require("./node");
    var Pass = require("../pass");
    var FrameBuffer = require("../../framebuffer");
    var texturePool = require("./texturepool");

    var SceneNode = Node.derive( function(){
        return {
            scene : null,
            camera : null,
            material : null
        }
    }, function(){
        if(this.frameBuffer){
            this.frameBuffer.depthBuffer = true;
        }
    }, {
        render : function( renderer ){

            if( ! this.outputs){
                renderer.render( this.scene, this.camera );
            }else{
                
                var frameBuffer = this.frameBuffer;

                for( var name in this.outputs){
                    var outputInfo = this.outputs[name];
                    var texture = texturePool.get( outputInfo.parameters );
                    this._textures[name] = texture;

                    var attachment = outputInfo.attachment || _gl.COLOR_ATTACHMENT0;
                    if(typeof(attachment) == "string"){
                        attachment = _gl[attachment];
                    }
                    frameBuffer.attach( renderer.gl, texture, attachment);
                }
                frameBuffer.bind( renderer );

                if( this.material ){
                    this.scene.material = this.material;
                }
                renderer.render( this.scene, this.camera );
                this.scene.material = null;

                frameBuffer.unbind( renderer );
            }
        }
    })

    return SceneNode;
} );
/**
 * @export{class} TextureNode
 */
define('3d/compositor/graph/texturenode',['require','./node','../../framebuffer','./texturepool','../../shader'], function( require ){

    var Node = require("./node");
    var FrameBuffer = require("../../framebuffer");
    var texturePool = require("./texturepool");
    var Shader = require("../../shader");

    var TextureNode = Node.derive( function(){
        return {
            
            shader : Shader.source("buildin.compositor.output"),

            texture : null
        }
    }, {
        render : function( renderer ){
            var _gl = renderer.gl;
            this.pass.setUniform("texture", this.texture);
            
            if( ! this.outputs){
                this.pass.outputs = null;
                this.pass.render( renderer );
            }else{
                
                this.pass.outputs = {};

                for( var name in this.outputs){

                    var outputInfo = this.outputs[name];

                    var texture = texturePool.get( outputInfo.parameters );
                    this._textures[name] = texture;

                    var attachment = outputInfo.attachment || _gl.COLOR_ATTACHMENT0;
                    if(typeof(attachment) == "string"){
                        attachment = _gl[attachment];
                    }
                    this.pass.outputs[ attachment ] = texture;

                }

                this.pass.render( renderer, this.frameBuffer );
            }
        }
    })

    return TextureNode;
} );
;
define("3d/debug/pointlight", function(){});

/**
 * @export{class} RenderInfo
 */
define('3d/debug/renderinfo',['require','core/base'], function(require){

    var Base = require("core/base");

    var RenderInfo = Base.derive( function(){
        return {
            renderer : null,

            frameTime : 0,

            vertexNumber : 0,

            faceNumber : 0,

            drawcallNumber : 0,

            meshNumber : 0,

            _startTime : 0
        }
    }, {
        enable : function(){
            this.renderer.on("beforerender", this._beforeRender, this);
            this.renderer.on("afterrender", this._afterRender, this);
            this.renderer.on("afterrender:mesh", this._afterRenderMesh, this);
        },
        disable : function(){
            this.renderer.off("beforerender", this._beforeRender);
            this.renderer.off("afterrender", this._afterRender);
            this.renderer.off("afterrender:mesh", this._afterRenderMesh);
        },
        clear : function(){
            this.vertexNumber = 0;
            this.faceNumber = 0;
            this.drawcallNumber = 0;
            this.meshNumber = 0;
            this.frameTime = 0;
        },
        _beforeRender : function(){
            this.clear();

            this._startTime = new Date().getTime();
        },

        _afterRender : function(){
            var endTime = new Date().getTime();

            this.frameTime = endTime - this._startTime;
        },

        _afterRenderMesh : function(_gl, drawInfo){
            this.vertexNumber += drawInfo.vertexNumber;
            this.faceNumber += drawInfo.faceNumber;
            this.drawcallNumber += drawInfo.drawcallNumber;
            this.meshNumber ++;
        }
    })

    return RenderInfo;
} );

define('3d/geometry/cube',['require','../geometry','./plane','core/matrix4','core/vector3','_'], function(require){

    var Geometry = require('../geometry');
    var Plane = require('./plane');
    var Matrix4 = require('core/matrix4');
    var Vector3 = require('core/vector3');
    var _ = require('_');

    var planeMatrix = new Matrix4();
    
    var Cube = Geometry.derive( function(){

        return {
            widthSegments : 1,
            heightSegments : 1,
            depthSegments : 1,
            // TODO double side material
            inside : false
        }
    }, function(){
        var planes = {
            "px" : createPlane("px", this.depthSegments, this.heightSegments),
            "nx" : createPlane("nx", this.depthSegments, this.heightSegments),
            "py" : createPlane("py", this.widthSegments, this.depthSegments),
            "ny" : createPlane("ny", this.widthSegments, this.depthSegments),
            "pz" : createPlane("pz", this.widthSegments, this.heightSegments),
            "nz" : createPlane("nz", this.widthSegments, this.heightSegments),
        };
        var cursor = 0;
        for( var pos in planes ){
            _.each(['position', 'texcoord0', 'normal'], function(attrName){
                var attrArray = planes[pos].attributes[attrName].value;
                for(var i = 0; i < attrArray.length; i++ ){
                    var value = attrArray[i];
                    if(this.inside && attrName === "normal"){
                        value[0] = -value[0];
                        value[1] = -value[1];
                        value[2] = -value[2];
                    }
                    this.attributes[attrName].value.push( value );
                }
                var plane = planes[pos];
                for(var i = 0; i < plane.faces.length; i++){
                    var face = plane.faces[i];
                    this.faces.push( [ face[0]+cursor, face[1]+cursor, face[2]+cursor ] );
                }
            }, this)
            cursor += planes[pos].getVerticesNumber();
        }
    })

    function createPlane( pos, widthSegments, heightSegments ){

        planeMatrix.identity();

        var plane = new Plane({
            widthSegments : widthSegments,
            heightSegments : heightSegments
        })

        switch( pos ){
            case "px":
                planeMatrix.translate(new Vector3(1, 0, 0) );
                planeMatrix.rotateY( Math.PI/2 );
                break;
            case "nx":
                planeMatrix.translate(new Vector3(-1, 0, 0) );
                planeMatrix.rotateY( -Math.PI/2 );
                break;
            case "py":
                planeMatrix.translate(new Vector3(0, 1, 0) );
                planeMatrix.rotateX( -Math.PI/2 );
                break;
            case "ny":
                planeMatrix.translate(new Vector3(0, -1, 0) );
                planeMatrix.rotateX( Math.PI/2 );
                break;
            case "pz":
                planeMatrix.translate(new Vector3(0, 0, 1) );
                break;
            case "nz":
                planeMatrix.translate(new Vector3(0, 0, -1) );
                planeMatrix.rotateY( Math.PI );
                break;
        }
        plane.applyMatrix( planeMatrix );
        return plane;
    }

    return Cube;
} );
define('3d/geometry/sphere',['require','../geometry','glmatrix'], function(require){

	var Geometry = require('../geometry');
    var glMatrix = require('glmatrix');
    var vec3 = glMatrix.vec3;
    var vec2 = glMatrix.vec2;

	// From three.js SphereGeometry
	var Sphere = Geometry.derive( function(){

		return {
            widthSegments : 20,
            heightSegments : 20,

            phiStart : 0,
            phiLength : Math.PI * 2,

            thetaStart : 0,
            thetaLength : Math.PI,

            radius : 1
		}
	}, function(){
        
        var positions = this.attributes.position.value;
        var texcoords = this.attributes.texcoord0.value;
        var normals = this.attributes.normal.value;

        var x, y, z,
            u, v,
            i, j;
        var normal;

        var heightSegments = this.heightSegments,
            widthSegments = this.widthSegments,
            radius = this.radius,
            phiStart = this.phiStart,
            phiLength = this.phiLength,
            thetaStart = this.thetaStart,
            thetaLength = this.thetaLength,
            radius = this.radius;


        for ( j = 0; j <= heightSegments; j ++ ) {

            for ( i = 0; i <= widthSegments; i ++ ) {

                u = i / widthSegments;
                v = j / heightSegments;

                x = - radius * Math.cos(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);
                y = radius * Math.cos(thetaStart + v * thetaLength);
                z = radius * Math.sin(phiStart + u * phiLength) * Math.sin(thetaStart + v * thetaLength);

                positions.push( vec3.fromValues(x, y, z) );
                texcoords.push( vec2.fromValues(u, v) );

                normal = vec3.fromValues(x, y, z);
                normals.push( vec3.normalize(normal, normal) );

            }

        }

        var p1, p2, p3,
            i1, i2, i3, i4;
        var faces = this.faces;

        var len = widthSegments+1;

        for ( j = 0; j < heightSegments; j ++ ) {

            for ( i = 0; i < widthSegments; i ++ ) {

                i1 = j * len + i;
                i2 = j * len + i + 1;
                i3 = (j + 1) * len + i + 1;
                i4 = (j + 1) * len + i;

                faces.push( vec3.fromValues(i1, i2, i3) );
                faces.push( vec3.fromValues(i3, i4, i1) );
            }
        }
	})

    return Sphere;
} );
define('3d/light',['require','./node'], function(require){

    var Node = require("./node");

    var Light = Node.derive( function(){
        return {
            color : [1, 1, 1],
            intensity : 1.0,
            
            // Config for shadow map
            castShadow : true,
            shadowResolution : 512
        }
    }, {
    } );

    return Light;
} );
define('3d/light/ambient',['require','../light','../shader'], function(require){

    var Light = require('../light'),
        Shader = require('../shader');

    var SHADER_STR = [ '@export buildin.header.ambient_light',
                        'uniform vec3 ambientLightColor[ AMBIENT_LIGHT_NUMBER ];',
                        '@end;' ].join('\n');

    Shader.import(SHADER_STR);

    var AmbientLight = Light.derive(function(){
        return {
            castShadow : false
        }
    }, {

        type : 'AMBIENT_LIGHT',

        uniformTemplates : {
            'ambientLightColor' : {
                type : '3f',
                value : function( instance ){
                    var color = instance.color,
                        intensity = instance.intensity;
                    return [ color[0]*intensity, color[1]*intensity, color[1]*intensity ];
                }
            }
        }
    })

    return AmbientLight;
} );
define('3d/light/directional',['require','../light','../shader','core/vector3'], function(require){

    var Light = require('../light');
    var Shader = require('../shader');
    var Vector3 = require('core/vector3');

    var SHADER_STR = [ '@export buildin.header.directional_light',
                        'uniform vec3 directionalLightDirection[ DIRECTIONAL_LIGHT_NUMBER ];',
                        'uniform vec3 directionalLightColor[ DIRECTIONAL_LIGHT_NUMBER ];',
                        '@end;' ].join('\n');

    Shader.import(SHADER_STR);

    var DirectionalLight = Light.derive( function(){

        return {
            // Config of orthographic camera for shadow mapping generate
            shadowCamera : {
                left : -20,
                right : 20,
                top : 20,
                bottom : -20,
                near : 0,
                far : 100
            }
        }
    }, {

        type : 'DIRECTIONAL_LIGHT',

        uniformTemplates : {
            'directionalLightDirection' : {
                type : '3f',
                value : ( function(){
                    var z = new Vector3();
                    return function( instance ){
                        // Direction is target to eye
                        return z.copy(instance.matrix.forward).negate()._array;
                    }
                })()
            },
            'directionalLightColor' : {
                type : '3f',
                value : function( instance ){
                    var color = instance.color,
                        intensity = instance.intensity;
                    return [ color[0]*intensity, color[1]*intensity, color[1]*intensity ];
                }
            }
        }
    })

    return DirectionalLight;
} );
define('3d/light/point',['require','../light','../shader'], function(require){

    var Light = require('../light'),
        Shader = require('../shader');

    var SHADER_STR = [ '@export buildin.header.point_light',
                        
                        'uniform vec3 pointLightPosition[ POINT_LIGHT_NUMBER ];',
                        'uniform float pointLightRange[ POINT_LIGHT_NUMBER ];',
                        'uniform vec3 pointLightColor[ POINT_LIGHT_NUMBER ];',
                        '@end;' ].join('\n');

    Shader.import(SHADER_STR);

    var PointLight = Light.derive(function(){

        return {
            range : 100,

            castShadow : false,
        }
    }, {

        type : 'POINT_LIGHT',

        uniformTemplates : {
            'pointLightPosition' : {
                type : '3f',
                value : function( instance ){
                    return instance.getWorldPosition()._array;
                }
            },
            'pointLightRange' : {
                type : '1f',
                value : function( instance ){
                    return instance.range;
                }
            },
            'pointLightColor' : {
                type : '3f',
                value : function( instance ){
                    var color = instance.color,
                        intensity = instance.intensity;
                    return [ color[0]*intensity, color[1]*intensity, color[1]*intensity ];
                }
            }
        }
    })

    return PointLight;
} );
define('3d/light/spot',['require','../light','../shader','core/vector3'], function(require){

    var Light = require('../light');
    var Shader = require('../shader');
    var Vector3 = require('core/vector3');

    var SHADER_STR = [ '@export buildin.header.spot_light',
                        'uniform vec3 spotLightPosition[SPOT_LIGHT_NUMBER];',
                        'uniform vec3 spotLightDirection[SPOT_LIGHT_NUMBER];',
                        'uniform float spotLightRange[SPOT_LIGHT_NUMBER];',
                        'uniform float spotLightUmbraAngleCosine[SPOT_LIGHT_NUMBER];',
                        'uniform float spotLightPenumbraAngleCosine[SPOT_LIGHT_NUMBER];',
                        'uniform float spotLightFalloffFactor[SPOT_LIGHT_NUMBER];',
                        'uniform vec3 spotLightColor[SPOT_LIGHT_NUMBER];',
                        '@end;' ].join('\n');

    Shader.import(SHADER_STR);

    var SpotLight = Light.derive(function() {

        return {
            range : 20,
            umbraAngle : 30,
            penumbraAngle : 45,
            falloffFactor : 2.0
        }
    },{

        type : 'SPOT_LIGHT',

        uniformTemplates : {
            'spotLightPosition' : {
                type : '3f',
                value : function( instance ){
                    return instance.getWorldPosition()._array;
                }
            },
            'spotLightRange' : {
                type : '1f',
                value : function( instance ){
                    return instance.range;
                }
            },
            'spotLightUmbraAngleCosine' : {
                type : '1f',
                value : function( instance ){
                    return Math.cos(instance.umbraAngle * Math.PI / 180);
                }
            },
            'spotLightPenumbraAngleCosine' : {
                type : '1f',
                value : function( instance ){
                    return Math.cos(instance.penumbraAngle * Math.PI / 180);
                }
            },
            'spotLightFalloffFactor' : {
                type : '1f',
                value : function( instance ){
                    return instance.falloffFactor
                }
            },
            'spotLightDirection' : {
                type : '3f',
                value : ( function(){
                    var z = new Vector3();
                    return function( instance ){
                        // Direction is target to eye
                        return z.copy(instance.matrix.forward).negate()._array;
                    }
                })()
            },
            'spotLightColor' : {
                type : '3f',
                value : function( instance ){
                    var color = instance.color,
                        intensity = instance.intensity;
                    return [ color[0]*intensity, color[1]*intensity, color[1]*intensity ];
                }
            }
        }
    })

    return SpotLight;
} );
/**
 * @export{class} FirstPersonControl
 */
define('3d/plugin/firstpersoncontrol',['require','core/base','core/vector3','core/matrix4','core/quaternion'], function(require){

    var Base = require("core/base");
    var Vector3 = require("core/vector3");
    var Matrix4 = require("core/matrix4");
    var Quaternion = require("core/quaternion");

    var upVector = new Vector3(0, 1, 0);

    var FirstPersonControl = Base.derive(function(){
        return {
            camera : null,
            canvas : null,

            sensitivity : 1,
            speed : 0.4,

            _moveForward : false,
            _moveBackward : false,
            _moveLeft : false,
            _moveRight : false,

            _offsetPitch : 0,
            _offsetRoll : 0
        }
    }, {
        enable : function(){
            this.camera.on("beforeupdate", this._beforeUpdateCamera, this);

            this.camera.eulerOrder = ["Y", "X", "Z"];
            // Use pointer lock
            // http://www.html5rocks.com/en/tutorials/pointerlock/intro/
            var el = this.canvas;

            //Must request pointer lock after click event, can't not do it directly
            //Why ? ?
            el.addEventListener("click", this.requestPointerLock);

            document.addEventListener("pointerlockchange", bindOnce(this._lockChange, this), false);
            document.addEventListener("mozpointerlockchange", bindOnce(this._lockChange, this), false);
            document.addEventListener("webkitpointerlockchange", bindOnce(this._lockChange, this), false);

            document.addEventListener("keydown", bindOnce(this._keyDown, this), false);
            document.addEventListener("keyup", bindOnce(this._keyUp, this), false);
        },

        disable : function(){

            this.camera.off('beforeupdate', this._beforeUpdateCamera);

            var el = this.canvas;

            el.exitPointerLock = el.exitPointerLock ||
                                    el.mozExitPointerLock ||
                                    el.webkitExitPointerLock

            if( el.exitPointerLock ){
                el.exitPointerLock();
            }
            document.removeEventListener("pointerlockchange", bindOnce( this._lockChange, this ));
            document.removeEventListener("mozpointerlockchange", bindOnce( this._lockChange, this ));
            document.removeEventListener("webkitpointerlockchange", bindOnce( this._lockChange, this ));
        
        },

        requestPointerLock : function(){
            var el = this;
            el.requestPointerLock = el.requestPointerLock ||
                                    el.mozRequestPointerLock ||
                                    el.webkitRequestPointerLock;

            el.requestPointerLock();
        },

        _beforeUpdateCamera : (function(){

            var rotateQuat = new Quaternion();
            
            return function(){
                
                var camera = this.camera;

                var position = this.camera.position,
                    xAxis = camera.matrix.right.normalize(),
                    zAxis = camera.matrix.forward.normalize();

                if( this._moveForward){
                    // Opposite direction of z
                    position.scaleAndAdd(zAxis, -this.speed);
                }
                if( this._moveBackward){
                    position.scaleAndAdd(zAxis, this.speed);
                }
                if( this._moveLeft){
                    position.scaleAndAdd(xAxis, -this.speed/2);
                }
                if( this._moveRight){
                    position.scaleAndAdd(xAxis, this.speed/2);
                }


                camera.rotateAround(camera.position, upVector, -this._offsetPitch * Math.PI / 180);
                var xAxis = camera.matrix.right;
                camera.rotateAround(camera.position, xAxis, -this._offsetRoll * Math.PI / 180);

                this._offsetRoll = this._offsetPitch = 0;
            }

        })(),

        _lockChange : function(){
            if( document.pointerlockElement === this.canvas ||
                document.mozPointerlockElement === this.canvas ||
                document.webkitPointerLockElement === this.canvas){

                document.addEventListener('mousemove', bindOnce(this._mouseMove, this), false);
            }else{
                document.removeEventListener('mousemove', bindOnce(this._mouseMove, this), false);
            }
        },

        _mouseMove : function(e){
            var dx = e.movementX || 
                    e.mozMovementX ||
                    e.webkitMovementX || 0;
            var dy = e.movementY ||
                    e.mozMovementY ||
                    e.webkitMovementY || 0;

            this._offsetPitch += dx * this.sensitivity / 10;
            this._offsetRoll += dy * this.sensitivity / 10;
            
        },

        _keyDown : function(e){
            switch( e.keyCode){
                case 87: //w
                case 37: //up arrow
                    this._moveForward = true;
                    break;
                case 83: //s
                case 40: //down arrow
                    this._moveBackward = true;
                    break;
                case 65: //a
                case 37: //left arrow
                    this._moveLeft = true;
                    break;
                case 68: //d
                case 39: //right arrow
                    this._moveRight = true;
                    break; 
            }
        },

        _keyUp : function(e){
            switch( e.keyCode){
                case 87: //w
                case 37: //up arrow
                    this._moveForward = false;
                    break;
                case 83: //s
                case 40: //down arrow
                    this._moveBackward = false;
                    break;
                case 65: //a
                case 37: //left arrow
                    this._moveLeft = false;
                    break;
                case 68: //d
                case 39: //right arrow
                    this._moveRight = false;
                    break; 
            }
        }
    })

    function bindOnce( func, context){
        if( ! func.__bindfuc__){
            func.__bindfuc__ = function(){
                return func.apply(context, arguments); 
            }
        }
        return func.__bindfuc__;
    }

    return FirstPersonControl;
} );
/**
 * @export{class} OrbitControl
 */
define('3d/plugin/orbitcontrol',['require','core/base','core/vector3','core/matrix4','core/quaternion'], function(require){

    var Base = require("core/base");
    var Vector3 = require("core/vector3");
    var Matrix4 = require("core/matrix4");
    var Quaternion = require("core/quaternion");

    var upVector = new Vector3(0, 1, 0);

    var OrbitControl = Base.derive(function(){
        return {
            
            camera : null,
            canvas : null,

            sensitivity : 1,

            origin : new Vector3(),

            // Rotate around origin
            _offsetPitch : 0,
            _offsetRoll : 0,

            // Pan the origin
            _panX : 0,
            _panY : 0,

            // Offset of mouse move
            _offsetX : 0,
            _offsetY : 0,

            // Zoom with mouse wheel
            _forward : 0,

            _op : 0  //0 : ROTATE, 1 : PAN
        }
    }, {

        enable : function(){

            this.camera.on("beforeupdate", this._beforeUpdateCamera, this);

            this.canvas.addEventListener("mousedown", bindOnce(this._mouseDown, this), false);
            this.canvas.addEventListener("mousewheel", bindOnce(this._mouseWheel, this), false);
            this.canvas.addEventListener("DOMMouseScroll", bindOnce(this._mouseWheel, this), false);
        },

        disable : function(){
            this.camera.off("beforeupdate", this._beforeUpdateCamera);
            this.canvas.removeEventListener("mousedown", bindOnce(this._mouseDown, this));
            this.canvas.removeEventListener("mousewheel", bindOnce(this._mouseWheel, this));
            this.canvas.removeEventListener("DOMMouseScroll", bindOnce(this._mouseWheel, this));
            this._mouseUp();
        },

        _mouseWheel : function(e){
            var delta = e.wheelDelta // Webkit 
                        || -e.detail; // Firefox

            this._forward += delta * this.sensitivity;
        },

        _mouseDown : function(e){
            document.addEventListener("mousemove", bindOnce(this._mouseMove, this), false);
            document.addEventListener("mouseup", bindOnce(this._mouseUp, this), false);
            document.addEventListener("mouseout", bindOnce(this._mouseOut, this), false);

            this._offsetX = e.pageX;
            this._offsetY = e.pageY;

            // Rotate
            if( e.button === 0){
                this._op = 0;
            }else if( e.button === 1){
                this._op = 1;
            }
        },

        _mouseMove : function(e){
            var dx = e.pageX - this._offsetX,
                dy = e.pageY - this._offsetY;

            if(this._op === 0){
                this._offsetPitch += dx * this.sensitivity / 100;
                this._offsetRoll += dy * this.sensitivity / 100;
            }else if(this._op === 1){
                // TODO Auto fit the size of scene
                this._panX += dx * this.sensitivity / 20;
                this._panY += dy * this.sensitivity / 20;
            }

            this._offsetX = e.pageX;
            this._offsetY = e.pageY;
        },

        _mouseUp : function(){

            document.removeEventListener("mousemove", bindOnce(this._mouseMove, this));
            document.removeEventListener("mouseup", bindOnce(this._mouseUp, this));
            document.removeEventListener("mouseout", bindOnce(this._mouseOut, this));
        },

        _mouseOut : function(){
            this._mouseUp();
        },

        _beforeUpdateCamera : function(){

            var camera = this.camera;

            if( this._op === 0){
                // Rotate
                camera.rotateAround(this.origin, upVector, -this._offsetPitch);            
                var xAxis = camera.matrix.right;
                camera.rotateAround(this.origin, xAxis, -this._offsetRoll);
                this._offsetRoll = this._offsetPitch = 0;
            }
            else if( this._op === 1){
                // Pan
                var xAxis = camera.matrix.right.normalize().scale(-this._panX);
                var yAxis = camera.matrix.up.normalize().scale(this._panY);
                camera.position.add(xAxis).add(yAxis);
                this.origin.add(xAxis).add(yAxis);
                this._panX = this._panY = 0;
            }
            
            // Zoom
            var zAxis = camera.matrix.forward.normalize();
            var distance = camera.position.distance(this.origin);
            camera.position.scaleAndAdd(zAxis, distance * this._forward / 2000);
            this._forward = 0;

        }
    });

    function bindOnce( func, context){
        if( ! func.__bindfuc__){
            func.__bindfuc__ = function(){
                return func.apply(context, arguments); 
            }
        }
        return func.__bindfuc__;
    }

    return OrbitControl;
} );
define('text!3d/shader/source/basic.essl',[],function () { return '@export buildin.basic.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 normal : NORMAL;\n\nattribute vec3 barycentric;\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Barycentric;\n\nvoid main(){\n\n    gl_Position = worldViewProjection * vec4( position, 1.0 );\n\n    v_Texcoord = texcoord * uvRepeat;\n    v_Barycentric = barycentric;\n}\n\n@end\n\n\n\n\n@export buildin.basic.fragment\n\nvarying vec2 v_Texcoord;\nuniform sampler2D diffuseMap;\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n@import buildin.util.edge_factor\n\nvoid main(){\n\n    gl_FragColor = vec4(color, alpha);\n    \n    #ifdef DIFFUSEMAP_ENABLED\n        vec4 tex = texture2D( diffuseMap, v_Texcoord );\n        gl_FragColor.rgb *= tex.rgb;\n    #endif\n    \n    if( lineWidth > 0.01){\n        gl_FragColor.xyz = gl_FragColor.xyz * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n}\n\n@end';});

define('text!3d/shader/source/lambert.essl',[],function () { return '/**\n * http://en.wikipedia.org/wiki/Lambertian_reflectance\n */\n\n@export buildin.lambert.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;\nuniform mat4 world : WORLD;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 normal : NORMAL;\n\nattribute vec3 barycentric;\n\n#ifdef SKINNING\nattribute vec3 boneWeight;\nattribute vec4 boneIndex;\n\nuniform mat4 boneMatrices[ BONE_MATRICES_NUMBER ];\n#endif\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\nvarying vec3 v_Barycentric;\n\nvoid main(){\n\n    vec3 skinnedPosition = position;\n    #ifdef SKINNING\n        mat4 skinMatrix;\n        if(boneIndex.x >= 0.0){\n            skinMatrix = boneMatrices[int(boneIndex.x)] * boneWeight.x;\n        }\n        if(boneIndex.y >= 0.0){\n            skinMatrix += boneMatrices[int(boneIndex.y)] * boneWeight.y;\n        }\n        if(boneIndex.z >= 0.0){\n            skinMatrix += boneMatrices[int(boneIndex.z)] * boneWeight.z;\n        }\n        if(boneIndex.w >= 0.0){\n            skinMatrix += boneMatrices[int(boneIndex.w)] * (1.0-boneWeight.x-boneWeight.y-boneWeight.z);\n        }\n        skinnedPosition = (skinMatrix * vec4(position, 1.0)).xyz;\n\n        skinnedNormal = (skinMatrix * vec4(normal, 0.0)).xyz;\n        skinnedTangent = (skinMatrix * vec4(tangent.xyz, 0.0)).xyz;\n    #endif\n\n    gl_Position = worldViewProjection * vec4( skinnedPosition, 1.0 );\n\n    v_Texcoord = texcoord * uvRepeat;\n    v_Normal = normalize( ( worldInverseTranspose * vec4(normal, 0.0) ).xyz );\n    v_WorldPosition = ( world * vec4( skinnedPosition, 1.0) ).xyz;\n\n    v_Barycentric = barycentric;\n}\n\n@end\n\n\n\n\n@export buildin.lambert.fragment\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\n\nuniform sampler2D diffuseMap;\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n#ifdef AMBIENT_LIGHT_NUMBER\n@import buildin.header.ambient_light\n#endif\n#ifdef POINT_LIGHT_NUMBER\n@import buildin.header.point_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_NUMBER\n@import buildin.header.directional_light\n#endif\n#ifdef SPOT_LIGHT_NUMBER\n@import buildin.header.spot_light\n#endif\n\n#extension GL_OES_standard_derivatives : enable\n// Import util functions and uniforms needed\n@import buildin.util.calculate_attenuation\n\n@import buildin.util.edge_factor\n\n@import buildin.plugin.compute_shadow_map\n\nvoid main(){\n    \n    gl_FragColor = vec4(color, alpha);\n\n    #ifdef DIFFUSEMAP_ENABLED\n        vec4 tex = texture2D( diffuseMap, v_Texcoord );\n        // http://freesdk.crydev.net/display/SDKDOC3/Specular+Maps\n        gl_FragColor.rgb *= tex.rgb;\n    #endif\n\n    vec3 diffuseColor = vec3(0.0, 0.0, 0.0);\n    \n    #ifdef AMBIENT_LIGHT_NUMBER\n        for(int i = 0; i < AMBIENT_LIGHT_NUMBER; i++){\n            diffuseColor += ambientLightColor[i];\n        }\n    #endif\n    // Compute point light color\n    #ifdef POINT_LIGHT_NUMBER\n        #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowFallOffs[POINT_LIGHT_NUMBER];\n            if( shadowEnabled ){\n                computeShadowFallOfPointLights( v_WorldPosition, shadowFallOffs );\n            }\n        #endif\n        for(int i = 0; i < POINT_LIGHT_NUMBER; i++){\n\n            vec3 lightPosition = pointLightPosition[i];\n            vec3 lightColor = pointLightColor[i];\n            float range = pointLightRange[i];\n\n            vec3 lightDirection = lightPosition - v_WorldPosition;\n\n            // Calculate point light attenuation\n            float dist = length(lightDirection);\n            float attenuation = calculateAttenuation(dist, range);\n\n            // Normalize vectors\n            lightDirection /= dist;\n\n            float ndl = dot( v_Normal, lightDirection );\n\n            float shadowFallOff = 1.0;\n            #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled ){\n                    shadowFallOff = shadowFallOffs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * clamp(ndl, 0.0, 1.0) * attenuation * shadowFallOff;\n        }\n    #endif\n    #ifdef DIRECTIONAL_LIGHT_NUMBER\n        #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n            float shadowFallOffs[DIRECTIONAL_LIGHT_NUMBER];\n            if( shadowEnabled ){\n                computeShadowFallOfDirectionalLights( v_WorldPosition, shadowFallOffs );\n            }\n        #endif\n        for(int i = 0; i < DIRECTIONAL_LIGHT_NUMBER; i++){\n            vec3 lightDirection = -directionalLightDirection[i];\n            vec3 lightColor = directionalLightColor[i];\n            \n            float ndl = dot( v_Normal, normalize( lightDirection ) );\n\n            float shadowFallOff = 1.0;\n            #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled ){\n                    shadowFallOff = shadowFallOffs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * clamp(ndl, 0.0, 1.0) * shadowFallOff;\n        }\n    #endif\n    \n    #ifdef SPOT_LIGHT_NUMBER\n        #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowFallOffs[SPOT_LIGHT_NUMBER];\n            if( shadowEnabled ){\n                computeShadowFallOfSpotLights( v_WorldPosition, shadowFallOffs );\n            }\n        #endif\n        for(int i = 0; i < SPOT_LIGHT_NUMBER; i++){\n            vec3 lightPosition = -spotLightPosition[i];\n            vec3 spotLightDirection = -normalize( spotLightDirection[i] );\n            vec3 lightColor = spotLightColor[i];\n            float range = spotLightRange[i];\n            float umbraAngleCosine = spotLightUmbraAngleCosine[i];\n            float penumbraAngleCosine = spotLightPenumbraAngleCosine[i];\n            float falloffFactor = spotLightFalloffFactor[i];\n\n            vec3 lightDirection = lightPosition - v_WorldPosition;\n            // Calculate attenuation\n            float dist = length(lightDirection);\n            float attenuation = calculateAttenuation(dist, range); \n\n            // Normalize light direction\n            lightDirection /= dist;\n            // Calculate spot light fall off\n            float lightDirectCosine = dot(spotLightDirection, lightDirection);\n\n            float falloff;\n            if( lightDirectCosine < penumbraAngleCosine ){\n                falloff = 1.0;\n            }else if( lightDirectCosine > umbraAngleCosine ){\n                falloff = 0.0;\n            }else{\n                falloff = (lightDirectCosine-umbraAngleCosine)/(penumbraAngleCosine-umbraAngleCosine);\n                falloff = pow(falloff, falloffFactor);\n            }\n\n            float ndl = dot( v_Normal, lightDirection );\n            ndl = clamp(ndl, 0.0, 1.0);\n\n            float shadowFallOff = 1.0;\n            #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled ){\n                    shadowFallOff = shadowFallOffs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * ndl * attenuation * (1.0-falloff) * shadowFallOff;\n\n        }\n    #endif\n\n    gl_FragColor.xyz *= diffuseColor;\n    if( lineWidth > 0.01){\n        gl_FragColor.xyz = gl_FragColor.xyz * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n\n}\n\n@end';});

define('text!3d/shader/source/phong.essl',[],function () { return '\n// http://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_shading_model\n\n@export buildin.phong.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 worldInverseTranspose : WORLDINVERSETRANSPOSE;\nuniform mat4 world : WORLD;\n\nuniform vec2 uvRepeat : [1.0, 1.0];\n\nattribute vec3 position : POSITION;\nattribute vec2 texcoord : TEXCOORD_0;\nattribute vec3 normal : NORMAL;\nattribute vec4 tangent : TANGENT;\n\nattribute vec3 barycentric;\n\n#ifdef SKINNING\nattribute vec3 boneWeight;\nattribute vec4 boneIndex;\n\nuniform mat4 boneMatrices[ BONE_MATRICES_NUMBER ];\n#endif\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\nvarying vec3 v_Barycentric;\n\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\n\nvoid main(){\n    \n    vec3 skinnedPosition = position;\n    vec3 skinnedNormal = normal;\n    vec3 skinnedTangent = tangent.xyz;\n    #ifdef SKINNING\n        mat4 skinMatrix;\n        if(boneIndex.x >= 0.0){\n            skinMatrix = boneMatrices[int(boneIndex.x)] * boneWeight.x;\n        }\n        if(boneIndex.y >= 0.0){\n            skinMatrix += boneMatrices[int(boneIndex.y)] * boneWeight.y;\n        }\n        if(boneIndex.z >= 0.0){\n            skinMatrix += boneMatrices[int(boneIndex.z)] * boneWeight.z;\n        }\n        if(boneIndex.w >= 0.0){\n            skinMatrix += boneMatrices[int(boneIndex.w)] * (1.0-boneWeight.x-boneWeight.y-boneWeight.z);\n        }\n        skinnedPosition = (skinMatrix * vec4(position, 1.0)).xyz;\n        // Normal matrix ???\n        skinnedNormal = (skinMatrix * vec4(normal, 0.0)).xyz;\n        skinnedTangent = (skinMatrix * vec4(tangent.xyz, 0.0)).xyz;\n\n    #endif\n\n    gl_Position = worldViewProjection * vec4( skinnedPosition, 1.0 );\n\n    v_Texcoord = texcoord * uvRepeat;\n    v_WorldPosition = ( world * vec4( skinnedPosition, 1.0) ).xyz;\n    v_Barycentric = barycentric;\n\n    v_Normal = normalize( ( worldInverseTranspose * vec4(skinnedNormal, 0.0) ).xyz );\n    v_Tangent = normalize( (worldInverseTranspose * vec4(skinnedTangent, 0.0) ).xyz );\n    v_Bitangent = normalize( cross(v_Normal, v_Tangent) * tangent.w );\n\n}\n\n@end\n\n\n@export buildin.phong.fragment\n\nuniform mat4 viewInverse : VIEWINVERSE;\n\nvarying vec2 v_Texcoord;\nvarying vec3 v_Normal;\nvarying vec3 v_WorldPosition;\nvarying vec3 v_Tangent;\nvarying vec3 v_Bitangent;\n\nuniform sampler2D diffuseMap;\nuniform sampler2D normalMap;\nuniform sampler2D environmentMap;\n\nuniform vec3 color : [1.0, 1.0, 1.0];\nuniform float alpha : 1.0;\n\nuniform float shininess : 30;\n\nuniform vec3 specular : [1.0, 1.0, 1.0];\n\n// Uniforms for wireframe\nuniform float lineWidth : 0.0;\nuniform vec3 lineColor : [0.0, 0.0, 0.0];\nvarying vec3 v_Barycentric;\n\n#ifdef AMBIENT_LIGHT_NUMBER\n@import buildin.header.ambient_light\n#endif\n#ifdef POINT_LIGHT_NUMBER\n@import buildin.header.point_light\n#endif\n#ifdef DIRECTIONAL_LIGHT_NUMBER\n@import buildin.header.directional_light\n#endif\n#ifdef SPOT_LIGHT_NUMBER\n@import buildin.header.spot_light\n#endif\n\n#extension GL_OES_standard_derivatives : enable\n// Import util functions and uniforms needed\n@import buildin.util.calculate_attenuation\n\n@import buildin.util.edge_factor\n\n@import buildin.plugin.compute_shadow_map\n\nvoid main(){\n    \n    vec4 finalColor = vec4(color, alpha);\n\n    #ifdef DIFFUSEMAP_ENABLED\n        vec4 tex = texture2D( diffuseMap, v_Texcoord );\n        finalColor.rgb *= tex.rgb;\n    #endif\n\n    vec3 normal = v_Normal;\n    #ifdef NORMALMAP_ENABLED\n        normal = texture2D( normalMap, v_Texcoord ).xyz * 2.0 - 1.0;\n        mat3 tbn = mat3( v_Tangent, v_Bitangent, v_Normal );\n        normal = normalize( tbn * normal );\n    #endif\n\n    // Diffuse part of all lights\n    vec3 diffuseColor = vec3(0.0, 0.0, 0.0);\n    // Specular part of all lights\n    vec3 specularColor = vec3(0.0, 0.0, 0.0);\n    \n    vec3 eyePos = viewInverse[3].xyz;\n    vec3 viewDirection = normalize(eyePos - v_WorldPosition);\n\n    #ifdef AMBIENT_LIGHT_NUMBER\n        for(int i = 0; i < AMBIENT_LIGHT_NUMBER; i++){\n            diffuseColor += ambientLightColor[i];\n        }\n    #endif\n    #ifdef POINT_LIGHT_NUMBER\n        #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowFallOffs[POINT_LIGHT_NUMBER];\n            if( shadowEnabled ){\n                computeShadowFallOfPointLights( v_WorldPosition, shadowFallOffs );\n            }\n        #endif\n        for(int i = 0; i < POINT_LIGHT_NUMBER; i++){\n\n            vec3 lightPosition = pointLightPosition[i];\n            vec3 lightColor = pointLightColor[i];\n            float range = pointLightRange[i];\n\n            vec3 lightDirection = lightPosition - v_WorldPosition;\n\n            // Calculate point light attenuation\n            float dist = length(lightDirection);\n            float attenuation = calculateAttenuation(dist, range); \n\n            // Normalize vectors\n            lightDirection /= dist;\n            vec3 halfVector = normalize( lightDirection + viewDirection );\n\n            float ndh = dot( normal, halfVector );\n            ndh = clamp(ndh, 0.0, 1.0);\n\n            float ndl = dot( normal,  lightDirection );\n            ndl = clamp(ndl, 0.0, 1.0);\n\n            float shadowFallOff = 1.0;\n            #if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled ){\n                    shadowFallOff = shadowFallOffs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * ndl * attenuation * shadowFallOff;\n\n            specularColor += specular * pow( ndh, shininess ) * attenuation * shadowFallOff;\n\n        }\n    #endif\n\n    #ifdef DIRECTIONAL_LIGHT_NUMBER\n        #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n            float shadowFallOffs[DIRECTIONAL_LIGHT_NUMBER];\n            if( shadowEnabled ){\n                computeShadowFallOfDirectionalLights( v_WorldPosition, shadowFallOffs );\n            }\n        #endif\n        for(int i = 0; i < DIRECTIONAL_LIGHT_NUMBER; i++){\n\n            vec3 lightDirection = -normalize( directionalLightDirection[i] );\n            vec3 lightColor = directionalLightColor[i];\n\n            vec3 halfVector = normalize( lightDirection + viewDirection );\n\n            float ndh = dot( normal, halfVector );\n            ndh = clamp(ndh, 0.0, 1.0);\n\n            float ndl = dot( normal, lightDirection );\n            ndl = clamp(ndl, 0.0, 1.0);\n\n            float shadowFallOff = 1.0;\n            #if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled ){\n                    shadowFallOff = shadowFallOffs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * ndl * shadowFallOff;\n\n            specularColor += specular * pow( ndh, shininess ) * shadowFallOff;\n        }\n    #endif\n\n    #ifdef SPOT_LIGHT_NUMBER\n        #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n            float shadowFallOffs[SPOT_LIGHT_NUMBER];\n            if( shadowEnabled ){\n                computeShadowFallOfSpotLights( v_WorldPosition, shadowFallOffs );\n            }\n        #endif\n        for(int i = 0; i < SPOT_LIGHT_NUMBER; i++){\n            vec3 lightPosition = spotLightPosition[i];\n            vec3 spotLightDirection = -normalize( spotLightDirection[i] );\n            vec3 lightColor = spotLightColor[i];\n            float range = spotLightRange[i];\n            float umbraAngleCosine = spotLightUmbraAngleCosine[i];\n            float penumbraAngleCosine = spotLightPenumbraAngleCosine[i];\n            float falloffFactor = spotLightFalloffFactor[i];\n\n            vec3 lightDirection = lightPosition - v_WorldPosition;\n            // Calculate attenuation\n            float dist = length(lightDirection);\n            float attenuation = calculateAttenuation(dist, range); \n\n            // Normalize light direction\n            lightDirection /= dist;\n            // Calculate spot light fall off\n            float lightDirectCosine = dot(spotLightDirection, lightDirection);\n\n            float falloff;\n            // Fomular from real-time-rendering\n            if( lightDirectCosine < penumbraAngleCosine ){\n                falloff = 1.0;\n            }else if( lightDirectCosine > umbraAngleCosine ){\n                falloff = 0.0;\n            }else{\n                falloff = (lightDirectCosine-umbraAngleCosine)/(penumbraAngleCosine-umbraAngleCosine);\n                falloff = pow(falloff, falloffFactor);\n            }\n\n            vec3 halfVector = normalize( lightDirection + viewDirection );\n\n            float ndh = dot( normal, halfVector );\n            ndh = clamp(ndh, 0.0, 1.0);\n\n            float ndl = dot( normal, lightDirection );\n            ndl = clamp(ndl, 0.0, 1.0);\n\n            float shadowFallOff = 1.0;\n            #if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n                if( shadowEnabled ){\n                    shadowFallOff = shadowFallOffs[i];\n                }\n            #endif\n\n            diffuseColor += lightColor * ndl * attenuation * (1.0-falloff) * shadowFallOff;\n\n            specularColor += specular * pow( ndh, shininess ) * attenuation * (1.0-falloff) * shadowFallOff;\n\n        }\n    #endif\n\n    finalColor.rgb *= diffuseColor;\n    finalColor.rgb += specularColor;\n\n    if( lineWidth > 0.01){\n        finalColor.rgb = finalColor.rgb * mix(lineColor, vec3(1.0), edgeFactor(lineWidth));\n    }\n\n    gl_FragColor = finalColor;\n}\n\n@end';});

define('text!3d/shader/source/wireframe.essl',[],function () { return '@export buildin.wireframe.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 world : WORLD;\n\nattribute vec3 position : POSITION;\nattribute vec3 barycentric;\n\nvarying vec3 v_Barycentric;\n\nvoid main(){\n\n    gl_Position = worldViewProjection * vec4( position, 1.0 );\n\n    v_Barycentric = barycentric;\n}\n\n@end\n\n\n@export buildin.wireframe.fragment\n\nuniform vec3 color : [0.0, 0.0, 0.0];\n\nuniform float alpha : 1.0;\nuniform float lineWidth : 1.5;\n\nvarying vec3 v_Barycentric;\n\n#extension GL_OES_standard_derivatives : enable\n\n@import buildin.util.edge_factor\n\nvoid main(){\n\n    gl_FragColor.rgb = color;\n    gl_FragColor.a = ( 1.0-edgeFactor(lineWidth) ) * alpha;\n}\n\n@end';});

define('text!3d/shader/source/util.essl',[],function () { return '// Use light attenuation formula in\n// http://blog.slindev.com/2011/01/10/natural-light-attenuation/\n@export buildin.util.calculate_attenuation\n\nuniform float attenuationFactor : 5.0;\n\nfloat calculateAttenuation(float dist, float range){\n    float attenuation = 1.0;\n    if( range > 0.0){\n        attenuation = dist*dist/(range*range);\n        float att_s = attenuationFactor;\n        attenuation = 1.0/(attenuation*att_s+1.0);\n        att_s = 1.0/(att_s+1.0);\n        attenuation = attenuation - att_s;\n        attenuation /= 1.0 - att_s;\n    }\n    return attenuation;\n}\n\n@end\n\n//http://codeflow.org/entries/2012/aug/02/easy-wireframe-display-with-barycentric-coordinates/\n@export buildin.util.edge_factor\n\nfloat edgeFactor(float width){\n    vec3 d = fwidth(v_Barycentric);\n    vec3 a3 = smoothstep(vec3(0.0), d * width, v_Barycentric);\n    return min(min(a3.x, a3.y), a3.z);\n}\n\n@end\n\n// http://aras-p.info/blog/2009/07/30/encoding-floats-to-rgba-the-final/\n// http://www.gamedev.net/topic/442138-packing-a-float-into-a-a8r8g8b8-texture-shader/\n@export buildin.util.pack_depth\nvec4 packDepth( const in float depth ){\n\n    const vec4 bitShifts = vec4( 256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0 );\n    const vec4 bitMask = vec4( 0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0 );\n\n    vec4 rgba = fract( depth * bitShifts );\n\n    rgba -= rgba.xxyz * bitMask;\n\n    return rgba;\n}\n@end\n\n@export buildin.util.unpack_depth\nfloat unpackDepth( const in vec4 rgba ){\n    const vec4 bitShifts = vec4(1.0/(256.0*256.0*256.0), 1.0/(256.0*256.0), 1.0/256.0, 1.0);\n    return dot(rgba, bitShifts);\n}\n@end\n\n@export buildin.util.pack_depth_half\nvec2 packDepthHalf( const in float depth ){\n    const vec2 bitShifts = vec2(256.0, 1.0);\n    const vec4 bitMask = vec4(0.0, 1.0/256.0);\n\n    vec2 rg = fract(depth*bitShifts);\n    rg -= rg.xx * bitMask;\n\n    return rg;\n}\n@end\n\n@export buildin.util.unpack_depth_half\nfloat unpackDepthHalf( const in vec2 rg ){\n    const vec4 bitShifts = vec2(1.0/256.0, 1.0);\n    return dot(rg, bitShifts);\n}\n@end';});

/**
 * @export{object} library
 */
define('3d/shader/library',['require','../shader','_','text!3d/shader/source/basic.essl','text!3d/shader/source/lambert.essl','text!3d/shader/source/phong.essl','text!3d/shader/source/wireframe.essl','text!3d/shader/source/util.essl'], function(require){

    var Shader = require("../shader");
    var _ = require("_");

    _library = {};

    _pool = {};

    // Example
    // ShaderLibrary.get("buildin.phong", "diffuse", "normal");
    // Or
    // ShaderLibrary.get("buildin.phong", ["diffuse", "normal"]);
    function get(name, enabledTextures){
        if( !enabledTextures){
            enabledTextures = [];
        }
        else if(typeof(enabledTextures) === "string"){
            enabledTextures = Array.prototype.slice.call(arguments, 1);
        }
        // Sort as first letter in increase order
        // And merge with name as a key string
        var key = name + "_" + enabledTextures.sort().join(",");
        if( _pool[key] ){
            return _pool[key];
        }else{
            var source = _library[name];
            if( ! source){
                console.error('Shader "'+name+'"'+' is not in the library');
                return;
            }
            var shader = new Shader({
                "vertex" : source.vertex,
                "fragment" : source.fragment
            })
            _.each(enabledTextures, function(symbol){
                shader.enableTexture(symbol);
            });
            _pool[key] = shader;
            return shader;
        }
    }

    function put(name, vertex, fragment){
        _library[name] = {
            vertex : vertex,
            fragment : fragment
        }
    }

    // Some build in shaders
    Shader.import( require('text!3d/shader/source/basic.essl') );
    Shader.import( require('text!3d/shader/source/lambert.essl') );
    Shader.import( require('text!3d/shader/source/phong.essl') );
    Shader.import( require('text!3d/shader/source/wireframe.essl') );
    Shader.import( require('text!3d/shader/source/util.essl') );
    // Shader.import( require('text!3d/shader/source/depth.essl') );

    put("buildin.basic", Shader.source("buildin.basic.vertex"), Shader.source("buildin.basic.fragment"));
    put("buildin.lambert", Shader.source("buildin.lambert.vertex"), Shader.source("buildin.lambert.fragment"));
    put("buildin.phong", Shader.source("buildin.phong.vertex"), Shader.source("buildin.phong.fragment"));
    put("buildin.wireframe", Shader.source("buildin.wireframe.vertex"), Shader.source("buildin.wireframe.fragment"));
    // put("buildin.depth", Shader.source("buildin.depth.vertex"), Shader.source("buildin.depth.fragment"));

    return {
        get : get,
        put : put
    }
} );
define('text!3d/prepass/vsm.essl',[],function () { return '/**\n *  Variance Shadow Mapping\n * http://www.punkuser.net/vsm/vsm_paper.pdf\n * http://developer.download.nvidia.com/SDK/10/direct3d/Source/VarianceShadowMapping/Doc/VarianceShadowMapping.pdf\n */\n@export buildin.vsm.depth.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\n\nattribute vec3 position : POSITION;\nvarying vec4 v_ViewPosition;\nvoid main(){\n\n    v_ViewPosition = worldViewProjection * vec4( position, 1.0 );\n    gl_Position = worldViewProjection * vec4( position , 1.0 );\n\n}\n@end\n\n\n@export buildin.vsm.depth.fragment\n\nvarying vec4 v_ViewPosition;\n\nvoid main(){\n    float z = v_ViewPosition.z / v_ViewPosition.w;\n\n    gl_FragColor = vec4(z, z*z, 0.0, 0.0);\n}\n@end\n\n// Point light shadow mapping\n// http://http.developer.nvidia.com/GPUGems/gpugems_ch12.html\n@export buildin.vsm.distance.vertex\n\nuniform mat4 worldViewProjection : WORLDVIEWPROJECTION;\nuniform mat4 world : WORLD;\n\nattribute vec3 position : POSITION;\n\nvarying vec3 v_WorldPosition;\n\nvoid main(){\n\n    gl_Position = worldViewProjection * vec4( position , 1.0 );\n    v_WorldPosition = ( world * vec4(position, 1.0) ).xyz;\n}\n\n@end\n\n@export buildin.vsm.distance.fragment\n\nuniform vec3 lightPosition;\n\nvarying vec3 v_WorldPosition;\n\nvoid main(){\n\n    float dist = distance(lightPosition, v_WorldPosition);\n\n    gl_FragColor = vec4(dist, dist * dist, 0.0, 0.0);\n}\n@end\n\n\n@export buildin.plugin.compute_shadow_map\n\n#if defined(SPOT_LIGHT_SHADOWMAP_NUMBER) || defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER) || defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n\n#ifdef SPOT_LIGHT_SHADOWMAP_NUMBER\nuniform sampler2D spotLightShadowMap[ SPOT_LIGHT_SHADOWMAP_NUMBER ];\nuniform mat4 spotLightMatrix[ SPOT_LIGHT_SHADOWMAP_NUMBER ]; \n#endif\n\n#ifdef DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER\nuniform sampler2D directionalLightShadowMap[ DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER ];\nuniform mat4 directionalLightMatrix[ DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER ];\n#endif\n\n#ifdef POINT_LIGHT_SHADOWMAP_NUMBER\nuniform samplerCube pointLightShadowMap[ POINT_LIGHT_SHADOWMAP_NUMBER ];\n#endif\n\nuniform bool shadowEnabled : true;\n\n#if defined(DIRECTIONAL_LIGHT_NUMBER) || defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n\nvec4 vsmBoxFilter(sampler2D texture, vec2 uv){\n    vec4 tex = texture2D(texture, uv);\n    float offset = 1.0/512.0;\n    tex += texture2D(texture, uv+vec2(offset, 0.0) );\n    tex += texture2D(texture, uv+vec2(offset, offset) );\n    tex += texture2D(texture, uv+vec2(-offset, offset) );\n    tex += texture2D(texture, uv+vec2(0.0, offset) );\n    tex += texture2D(texture, uv+vec2(-offset, 0.0) );\n    tex += texture2D(texture, uv+vec2(-offset, -offset) );\n    tex += texture2D(texture, uv+vec2(offset, -offset) );\n    tex += texture2D(texture, uv+vec2(0.0, -offset) );\n\n    tex /= 9.0;\n    return tex;\n}\n\nfloat computeShadowFalloff( sampler2D map, mat4 lightVPM, vec3 position){\n    vec4 posInLightSpace = ( lightVPM * vec4(position, 1.0) );\n    posInLightSpace.xyz /= posInLightSpace.w;\n\n    float z = posInLightSpace.z;\n    // In frustum\n    if( all(greaterThan(posInLightSpace.xyz, vec3(-1.0))) &&\n        all(lessThan(posInLightSpace.xyz, vec3(1.0))) ){\n        \n        // To texture uv\n        vec2 uv = (posInLightSpace.xy+1.0) / 2.0;\n        // vec2 moments = texture2D( map, uv ).xy;\n        vec2 moments = vsmBoxFilter( map, uv ).xy;\n        \n        float variance = moments.y - moments.x * moments.x;\n\n        float mD = moments.x - z;\n        float p = variance / (variance + mD * mD);\n\n        if(moments.x + 0.002 < z){\n            return clamp(p, 0.0, 1.0);\n        }else{\n            return 1.0;\n        }\n    }\n    return 1.0;\n}\n\n#endif\n\n#ifdef POINT_LIGHT_SHADOWMAP_NUMBER\n\nvec4 vsmBoxFilterCube(samplerCube texture, vec3 direction){\n    vec4 tex = textureCube(texture, direction);\n    float offset = 0.05;\n    tex += textureCube(texture, direction + vec3(offset, 0.0, 0.0) );\n    tex += textureCube(texture, direction + vec3(offset, offset, 0.0) );\n    tex += textureCube(texture, direction + vec3(-offset, offset, 0.0) );\n    tex += textureCube(texture, direction + vec3(0.0, offset, 0.0) );\n    tex += textureCube(texture, direction + vec3(-offset, 0.0, 0.0) );\n    tex += textureCube(texture, direction + vec3(-offset, -offset, 0.0) );\n    tex += textureCube(texture, direction + vec3(offset, -offset, 0.0) );\n    tex += textureCube(texture, direction + vec3(0.0, -offset, 0.0) );\n\n    tex /= 9.0;\n    return tex;\n}\n\nfloat computeShadowFallOfCube( samplerCube map, vec3 direction ){\n    \n    vec2 moments = vsmBoxFilterCube( map, direction).xy;\n\n    float variance = moments.y - moments.x * moments.x;\n\n    float dist = length(direction);\n    float mD = moments.x - dist;\n    float p = variance / (variance + mD * mD);\n\n    if(moments.x + 0.001 < dist){\n        return clamp(p, 0.0, 1.0);\n    }else{\n        return 1.0;\n    }\n}\n\n#endif\n\n#if defined(SPOT_LIGHT_SHADOWMAP_NUMBER)\n\nvoid computeShadowFallOfSpotLights( vec3 position, inout float shadowFalloffs[SPOT_LIGHT_NUMBER]  ){\n    for( int i = 0; i < SPOT_LIGHT_SHADOWMAP_NUMBER; i++){\n        float shadowFalloff = computeShadowFalloff( spotLightShadowMap[i], spotLightMatrix[i], position );\n        shadowFalloffs[ i ] = shadowFalloff;\n    }\n    // set default fallof of rest lights\n    for( int i = SPOT_LIGHT_SHADOWMAP_NUMBER; i < SPOT_LIGHT_NUMBER; i++){\n        shadowFalloffs[i] = 1.0;\n    }\n}\n\n#endif\n\n\n#if defined(POINT_LIGHT_SHADOWMAP_NUMBER)\n\nvoid computeShadowFallOfPointLights( vec3 position, inout float shadowFalloffs[POINT_LIGHT_NUMBER]  ){\n    for( int i = 0; i < POINT_LIGHT_SHADOWMAP_NUMBER; i++){\n        vec3 lightPosition = pointLightPosition[i];\n        vec3 direction = position - lightPosition;\n        shadowFalloffs[ i ] = computeShadowFallOfCube( pointLightShadowMap[i], direction );\n    }\n    for( int i = POINT_LIGHT_SHADOWMAP_NUMBER; i < POINT_LIGHT_NUMBER; i++){\n        shadowFalloffs[i] = 1.0;\n    }\n}\n\n#endif\n\n\n#if defined(DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER)\n\nvoid computeShadowFallOfDirectionalLights( vec3 position, inout float shadowFalloffs[DIRECTIONAL_LIGHT_NUMBER] ){\n    for( int i = 0; i < DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER; i++){\n        float shadowFalloff = computeShadowFalloff( directionalLightShadowMap[i], directionalLightMatrix[i], position );\n        shadowFalloffs[ i ] = shadowFalloff;\n    }\n    // set default fallof of rest lights\n    for( int i = DIRECTIONAL_LIGHT_SHADOWMAP_NUMBER; i < DIRECTIONAL_LIGHT_NUMBER; i++){\n        shadowFalloffs[i] = 1.0;\n    }\n}\n\n#endif\n\n#endif\n\n@end';});

/**
 * @export{class} ShadowMap
 */
define('3d/prepass/shadowmap',['require','core/base','core/vector3','../shader','../light','../light/spot','../light/directional','../light/point','../shader/library','../material','../framebuffer','../texture/texture2d','../texture/texturecube','../camera/perspective','../camera/orthographic','core/matrix4','_','text!./vsm.essl'], function(require){

    var Base = require("core/base");
    var Vector3 = require("core/vector3");
    var Shader = require("../shader");
    var Light = require("../light");
    var SpotLight = require("../light/spot");
    var DirectionalLight = require("../light/directional");
    var PointLight = require("../light/point");
    var shaderLibrary = require("../shader/library");
    var Material = require("../material");
    var FrameBuffer = require("../framebuffer");
    var Texture2d = require("../texture/texture2d");
    var TextureCube = require("../texture/texturecube");
    var PerspectiveCamera = require("../camera/perspective");
    var OrthoCamera = require("../camera/orthographic");

    var Matrix4 = require("core/matrix4");

    var _ = require("_");

    var frameBuffer = new FrameBuffer();

    Shader.import( require('text!./vsm.essl') );

    var ShadowMapPlugin = Base.derive(function(){
        return {

            technique : "VSM",  //"NORMAL", "PCF", "VSM"

            _textures : {},

            _cameras : {},

            _shadowMapNumber : {
                'POINT_LIGHT' : 0,
                'DIRECTIONAL_LIGHT' : 0,
                'SPOT_LIGHT' : 0
            },
            _shadowMapOrder : {
                'SPOT_LIGHT' : 0,
                'DIRECTIONAL_LIGHT' : 1,
                'SPOT_LIGHT' : 2
            }

        }
    }, function(){
        if( this.technique == "VSM"){
            this._depthMaterial =  new Material({
                shader : new Shader({
                    vertex : Shader.source("buildin.vsm.depth.vertex"),
                    fragment : Shader.source("buildin.vsm.depth.fragment")
                })
            });
            // Point light write the distance instance of depth projected
            // http://http.developer.nvidia.com/GPUGems/gpugems_ch12.html
            this._pointLightDepthMaterial = new Material({
                shader : new Shader({
                    vertex : Shader.source("buildin.vsm.distance.vertex"),
                    fragment : Shader.source("buildin.vsm.distance.fragment")
                })
            })
        }else{
            this._depthMaterial = new Material({
                shader : new Shader({
                    vertex : Shader.source("buildin.sm.depth.vertex"),
                    fragment : Shader.source("buildin.sm.depth.fragment")
                })
            })
            this._pointLightDepthMaterial = new Material({
                shader : new Shader({
                    vertex : Shader.source("buildin.sm.distance.vertex"),
                    fragment : Shader.source("buildin.sm.distance.fragment")
                })
            })
        }
    }, {

        render : function( renderer, scene ){
            this._renderShadowPass( renderer, scene );
        },

        _renderShadowPass : function( renderer, scene ){

            var renderQueue = [],
                lightCastShadow = [],
                meshReceiveShadow = [];

            var _gl = renderer.gl;

            scene.update();

            scene.traverse( function(node){
                if( node.instanceof(Light) ){
                    if( node.castShadow ){
                        lightCastShadow.push(node);
                    }
                }
                if( node.material && node.material.shader ){
                    if( node.castShadow ){
                        renderQueue.push(node);
                    }
                    if( node.receiveShadow ){
                        meshReceiveShadow.push(node);

                        node.material.setUniform("shadowEnabled", 1);
                    }else{
                        node.material.setUniform("shadowEnabled", 0);
                    }
                };
            } );

            _gl.enable( _gl.DEPTH_TEST );
            _gl.disable( _gl.BLEND );

            _gl.clearColor(0.0, 0.0, 0.0, 0.0);
            _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

            var targets = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
            var targetMap = {
                'px' : _gl.TEXTURE_CUBE_MAP_POSITIVE_X,
                'py' : _gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
                'pz' : _gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
                'nx' : _gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
                'ny' : _gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
                'nz' : _gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
            }
            var cursor = 0;

            // Shadow uniforms
            var spotLightShadowMaps = [],
                spotLightMatrices = [],
                directionalLightShadowMaps = [],
                directionalLightMatrices = [],
                pointLightShadowMaps = [];

            var order = this._shadowMapOrder;
            // Store the shadow map in order
            lightCastShadow.sort(function(a, b){
                return order[a] - order[b];
            })
            // reset
            for(var name in this._shadowMapNumber){
                this._shadowMapNumber[name] = 0;
            }
            // Create textures for shadow map
            _.each( lightCastShadow, function( light ){

                if( light.instanceof(SpotLight) ||
                    light.instanceof(DirectionalLight) ){
                    
                    var texture = this._getTexture(light.__GUID__, light);
                    var camera = this._getCamera(light.__GUID__, light);

                    frameBuffer.attach( renderer.gl, texture );
                    frameBuffer.bind(renderer);

                    _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

                    renderer._scene = scene;
                    renderer.renderQueue( renderQueue, camera, this._depthMaterial, true );

                    frameBuffer.unbind(renderer);
        
                    var matrix = new Matrix4();
                    matrix.copy(camera.worldMatrix)
                        .invert()
                        .multiplyLeft(camera.projectionMatrix);

                    if( light.instanceof(SpotLight) ){
                        spotLightShadowMaps.push(texture);
                        spotLightMatrices.push(matrix._array);
                    }else{
                        directionalLightShadowMaps.push(texture);
                        directionalLightMatrices.push(matrix._array);
                    }

                }else if(light.instanceof(PointLight) ){
                    
                    var texture = this._getTexture(light.__GUID__, light);
                    pointLightShadowMaps.push( texture );

                    for(var i = 0; i < 6; i++){
                        var target = targets[i];
                        var camera = this._getCamera(light.__GUID__, light, target);

                        frameBuffer.attach( renderer.gl, texture, _gl.COLOR_ATTACHMENT0, targetMap[target] );
                        frameBuffer.bind(renderer);

                        _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);

                        renderer._scene = scene;
                        this._pointLightDepthMaterial.setUniform("lightPosition", light.position._array);
                        renderer.renderQueue( renderQueue, camera, this._pointLightDepthMaterial, true );

                        frameBuffer.unbind(renderer);
                    }

                }

                this._shadowMapNumber[ light.type ] ++;
            }, this );

            for(var i = 0; i < meshReceiveShadow.length; i++){
                var mesh = meshReceiveShadow[i],
                    material = mesh.material;

                var shader = material.shader;

                var shaderNeedsUpdate = false;
                for( var name in this._shadowMapNumber ){
                    var number = this._shadowMapNumber[name];
                    var key = name + "_SHADOWMAP_NUMBER";

                    if( shader.fragmentDefines[key] !== number &&
                        number > 0){
                        shader.fragmentDefines[key] = number;
                        shaderNeedsUpdate = true;
                    }
                }
                if( shaderNeedsUpdate){
                    shader.update();
                }

                material.setUniforms({
                    "spotLightShadowMap" : spotLightShadowMaps,
                    "directionalLightShadowMap" : directionalLightShadowMaps,
                    "directionalLightMatrix" : directionalLightMatrices,
                    "pointLightShadowMap" : pointLightShadowMaps,
                    "spotLightMatrix" : spotLightMatrices,
                });
            }
        },

        _getTexture : function(key, light){
            var texture = this._textures[ key ];
            var resolution = light.shadowResolution || 512;
            var needsUpdate = false;
            if( texture ){
                if( texture.width !== resolution){
                    texture.dispose();
                    needsUpdate = true;
                }
            }else{
                needsUpdate = true;
            }
            if( needsUpdate){
                if( light.instanceof(PointLight) ){
                    texture = new TextureCube({
                        width : resolution,
                        height : resolution,
                        type : 'FLOAT'
                    })
                }else{
                    texture = new Texture2d({
                        width : resolution,
                        height : resolution,
                        type : 'FLOAT'
                    })   
                }
                this._textures[key] = texture;
            }

            return texture;
        },

        _getCamera : function(key, light, target){
            var camera = this._cameras[ key ];
            if( target && ! camera){
                camera = this._cameras[key] = {};
            }
            if( target){
                camera = camera[target];   
            }
            if( ! camera ){
                if( light.instanceof(SpotLight) ||
                    light.instanceof(PointLight) ){
                    camera = new PerspectiveCamera({
                        near : 0.1
                    });
                }else if( light.instanceof(DirectionalLight) ){
                    camera = new OrthoCamera( light.shadowCamera );
                }
                if( target ){
                    this._cameras[key][target] = camera;
                }else{
                    this._cameras[key] = camera;
                }
            }
            if( light.instanceof(SpotLight) ){
                // Update properties
                camera.fov = light.penumbraAngle * 2;
                camera.far = light.range;
            }
            if( light.instanceof(PointLight) ){
                camera.far = light.range;
                camera.fov = 90;

                camera.position.set(0, 0, 0);
                switch(target){
                    case 'px':
                        camera.lookAt( px, ny );
                        break;
                    case 'nx':
                        camera.lookAt( nx, ny );
                        break;
                    case 'py':
                        camera.lookAt( py, pz );
                        break;
                    case 'ny':
                        camera.lookAt( ny, nz );
                        break;
                    case 'pz':
                        camera.lookAt( pz, ny );
                        break;
                    case 'nz':
                        camera.lookAt( nz, ny );
                        break;
                }
                camera.position.copy( light.position );
                camera.update();

            }else{
                camera.worldMatrix.copy(light.worldMatrix);
            }
            camera.updateProjectionMatrix();

            return camera;
        }
    });
    
    var px = new Vector3(1, 0, 0);
    var nx = new Vector3(-1, 0, 0);
    var py = new Vector3(0, 1, 0);
    var ny = new Vector3(0, -1, 0);
    var pz = new Vector3(0, 0, 1);
    var nz = new Vector3(0, 0, -1);


    function createEmptyArray(size, value){
        var arr = [];
        for(var i = 0; i < size; i++){
            arr.push(value);
        }
        return arr;
    }
    return ShadowMapPlugin;
} );
define('3d/renderer',['require','core/base','_','glmatrix','util/util','./light','./mesh','./webglinfo'], function(require){

    var Base = require("core/base");
    var _ = require("_");
    var glMatrix = require("glmatrix");
    var mat4 = glMatrix.mat4;
    var util = require("util/util");
    var Light = require("./light");
    var Mesh = require("./mesh");
    var WebGLInfo = require('./webglinfo');

    var Renderer = Base.derive( function() {
        return {

            __GUID__ : util.genGUID(),

            canvas : null,
            // Device Pixel Ratio is for high defination disply
            // like retina display
            // http://www.khronos.org/webgl/wiki/HandlingHighDPI
            devicePixelRatio : window.devicePixelRatio || 1.0,

            color : [1.0, 1.0, 1.0, 0.0],
            
            // _gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT
            clear : 16640,  

            // Settings when getting context
            // http://www.khronos.org/registry/webgl/specs/latest/#2.4
            alhpa : true,
            depth : true,
            stencil : false,
            antialias : true,
            premultipliedAlpha : true,
            preserveDrawingBuffer : false,

            gl : null,

            viewportInfo : {},

        }
    }, function(){
        if ( ! this.canvas) {
            this.canvas = document.createElement("canvas");
        }
        try {
            this.gl = this.canvas.getContext('experimental-webgl', {
                alhpa : this.alhpa,
                depth : this.depth,
                stencil : this.stencil,
                antialias : this.antialias,
                premultipliedAlpha : this.premultipliedAlpha,
                preserveDrawingBuffer : this.preserveDrawingBuffer,
            });
            this.gl.__GUID__ = this.__GUID__;

            this.resize( this.canvas.width, this.canvas.height );

            WebGLInfo.initialize(this.gl);
        }
        catch(e) {
            throw "Error creating WebGL Context";
        }
    }, {

        resize : function(width, height) {
            var canvas = this.canvas;
            // http://www.khronos.org/webgl/wiki/HandlingHighDPI
            // set the display size of the canvas.
            canvas.style.width = width + "px";
            canvas.style.height = height + "px";
             
            // set the size of the drawingBuffer
            canvas.width = width * this.devicePixelRatio;
            canvas.height = height * this.devicePixelRatio;

            this.setViewport(0, 0, canvas.width, canvas.height );
        },

        setViewport : function(x, y, width, height) {

            this.gl.viewport( x, y, width, height );

            this.viewportInfo = {
                x : x,
                y : y,
                width : width,
                height : height
            }
        },

        render : function( scene, camera, silent ) {
            
            var _gl = this.gl;
            
            if( ! silent){
                // Render plugin like shadow mapping must set the silent true
                this.trigger("beforerender", scene, camera);
            }

            var color = this.color;
            _gl.clearColor(color[0], color[1], color[2], color[3]);
            _gl.clear(this.clear);

            var opaqueQueue = [];
            var transparentQueue = [];
            var lights = [];

            camera.update();
            scene.update();

            this._scene = scene;
            var sceneMaterial = scene.material;

            // Traverse the scene and add the renderable
            // object to the render queue;
            scene.traverse( function(node) {
                if( ! node.visible){
                    return true;
                }
                if( node.instanceof( Light ) ){
                    lights.push( node );
                }
                // A node have render method and material property
                // can be rendered on the scene
                if( ! node.render ) {
                    return;
                }
                if( sceneMaterial ){
                    if( sceneMaterial.transparent ){
                        transparentQueue.push( node );
                    }else{
                        opaqueQueue.push( node );
                    }
                }else{
                    if(! node.material || ! node.material.shader){
                        return;
                    }
                    if( ! node.geometry){
                        return;
                    }
                    if( node.material.transparent ){
                        transparentQueue.push( node );
                    }else{
                        opaqueQueue.push( node );
                    }
                }
            } )
    
            if( scene.filter ){
                opaqueQueue = _.filter( opaqueQueue, scene.filter );
                transparentQueue = _.filter( transparentQueue, scene.filter );
            }

            var lightNumber = {};
            for (var i = 0; i < lights.length; i++) {
                var light = lights[i];
                if( ! lightNumber[light.type] ){
                    lightNumber[light.type] = 0;
                }
                lightNumber[light.type]++;
            }
            scene.lightNumber = lightNumber;
            this.updateLightUnforms( lights );

            // Sort material to reduce the cost of setting uniform in material
            // PENDING : sort geometry ??
            opaqueQueue.sort( this._materialSortFunc );
            transparentQueue.sort( this._materialSortFunc );

            if( ! silent){
                this.trigger("beforerender:opaque", opaqueQueue);
            }

            _gl.enable( _gl.DEPTH_TEST );
            _gl.disable( _gl.BLEND );
            this.renderQueue( opaqueQueue, camera, sceneMaterial, silent );

            if( ! silent){
                this.trigger("afterrender:opaque", opaqueQueue);
                this.trigger("beforerender:transparent", transparentQueue);
            }

            _gl.disable(_gl.DEPTH_TEST);
            _gl.enable(_gl.BLEND);
            // Default blend function
            _gl.blendEquation( _gl.FUNC_ADD );
            _gl.blendFunc( _gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA);

            this.renderQueue( transparentQueue, camera, sceneMaterial, silent );

            if( ! silent){
                this.trigger("afterrender:transparent", transparentQueue);
                this.trigger("afterrender", scene, camera);
            }
        },


        updateLightUnforms : function(lights) {
            
            var lightUniforms = this._scene.lightUniforms;
            for (var symbol in this._scene.lightUniforms) {
                lightUniforms[symbol].length = 0;
            }
            for (var i = 0; i < lights.length; i++) {
                
                var light = lights[i];
                
                for ( symbol in light.uniformTemplates) {

                    var uniformTpl = light.uniformTemplates[symbol];
                    if( ! lightUniforms[symbol] ){
                        lightUniforms[ symbol] = [];
                    }
                    var value = uniformTpl.value( light );
                    var lu = lightUniforms[symbol];
                    switch(uniformTpl.type){
                        case "1i":
                        case "1f":
                            lu.push(value);
                            break;
                        case "2f":
                        case "3f":
                        case "4f":
                            for(var j =0; j < value.length; j++){
                                lu.push(value[j]);
                            }
                            break;
                        default:
                            console.error("Unkown light uniform type "+uniformTpl.type);
                    }
                }
            }
        },

        renderQueue : function( queue, camera, globalMaterial, silent ){

            // Calculate view and projection matrix
            mat4.invert( matrices['VIEW'],  camera.worldMatrix._array );
            mat4.copy( matrices['PROJECTION'], camera.projectionMatrix._array );
            mat4.multiply( matrices['VIEWPROJECTION'], camera.projectionMatrix._array, matrices['VIEW'] );
            mat4.copy( matrices['VIEWINVERSE'], camera.worldMatrix._array );
            mat4.invert( matrices['PROJECTIONINVERSE'], matrices['PROJECTION'] );
            mat4.invert( matrices['VIEWPROJECTIONINVERSE'], matrices['VIEWPROJECTION'] );

            var prevMaterialID;
            var prevShaderID;
            var _gl = this.gl;
            var scene = this._scene;
            
            for (var i =0; i < queue.length; i++) {
                var object = queue[i];
                var material = globalMaterial || object.material;
                var shader = material.shader;
                var geometry = object.geometry;
                var customBlend = material.transparent && material.blend;

                if (prevShaderID !== shader.__GUID__ ) {
                    // Set lights number
                    var lightNumberChanged = false;
                    if ( ! _.isEqual(shader.lightNumber, scene.lightNumber)) {
                        lightNumberChanged = true;
                    }
                    if ( lightNumberChanged ) {
                        for (var type in scene.lightNumber) {
                            var number = scene.lightNumber[ type ];
                            shader.lightNumber[ type ] = number;
                        }
                        shader.update();
                    }

                    shader.bind( _gl );
                    prevShaderID = shader.__GUID__;
                }
                if (prevMaterialID !== material.__GUID__) {
                    // Set lights uniforms
                    for (var symbol in scene.lightUniforms ) {
                        var uniform = material.uniforms[symbol];
                        if( uniform ){
                            uniform.value = scene.lightUniforms[symbol];
                        }
                    }

                    material.bind( _gl );
                    prevMaterialID = material.__GUID__;

                    Mesh.materialChanged();
                }

                if ( customBlend ){
                    customBlend( _gl );
                }

                var worldM = object.worldMatrix._array;

                // All matrices ralated to world matrix will be updated on demand;
                if ( shader.semantics.hasOwnProperty('WORLD') ||
                    shader.semantics.hasOwnProperty('WORLDTRANSPOSE') ) {
                    mat4.copy( matrices['WORLD'], worldM );
                }
                if ( shader.semantics.hasOwnProperty('WORLDVIEW') ||
                    shader.semantics.hasOwnProperty('WORLDVIEWINVERSE') ||
                    shader.semantics.hasOwnProperty('WORLDVIEWINVERSETRANSPOSE') ) {
                    mat4.multiply( matrices['WORLDVIEW'], matrices['VIEW'] , worldM);
                }
                if ( shader.semantics.hasOwnProperty('WORLDVIEWPROJECTION') ||
                    shader.semantics.hasOwnProperty('WORLDVIEWPROJECTIONINVERSE') ||
                    shader.semantics.hasOwnProperty('WORLDVIEWPROJECTIONINVERSETRANSPOSE') ){
                    mat4.multiply( matrices['WORLDVIEWPROJECTION'], matrices['VIEWPROJECTION'] , worldM);
                }
                if ( shader.semantics.hasOwnProperty('WORLDINVERSE') ||
                    shader.semantics.hasOwnProperty('WORLDINVERSETRANSPOSE') ) {
                    mat4.invert( matrices['WORLDINVERSE'], worldM );
                }
                if ( shader.semantics.hasOwnProperty('WORLDVIEWINVERSE') ||
                    shader.semantics.hasOwnProperty('WORLDVIEWINVERSETRANSPOSE') ) {
                    mat4.invert( matrices['WORLDVIEWINVERSE'], matrices['WORLDVIEW'] );
                }
                if ( shader.semantics.hasOwnProperty('WORLDVIEWPROJECTIONINVERSE') ||
                    shader.semantics.hasOwnProperty('WORLDVIEWPROJECTIONINVERSETRANSPOSE') ){
                    mat4.invert( matrices['WORLDVIEWPROJECTIONINVERSE'], matrices['WORLDVIEWPROJECTION'] );
                }

                for (var semantic in matrices) {

                    if( shader.semantics.hasOwnProperty( semantic ) ){
                        var matrix = matrices[semantic];
                        var semanticInfo = shader.semantics[semantic];
                        shader.setUniform( _gl, semanticInfo.type, semanticInfo.symbol, matrix);
                    }

                    var semanticTranspose = semantic + "TRANSPOSE";
                    if( shader.semantics.hasOwnProperty( semantic + "TRANSPOSE") ) {
                        var matrixTranspose = matrices[semantic+'TRANSPOSE'];
                        var matrix = matrices[semantic];
                        var semanticTransposeInfo = shader.semantics[semantic+"TRANSPOSE"];
                        mat4.transpose( matrixTranspose, matrix);
                        shader.setUniform( _gl, semanticTransposeInfo.type, semanticTransposeInfo.symbol, matrixTranspose  );
                    }
                }

                if( ! silent){
                    this.trigger("beforerender:mesh", object);
                }
                var drawInfo = object.render( this, globalMaterial );
                if( ! silent){
                    this.trigger("afterrender:mesh", object, drawInfo);
                }
                // Restore the default blend function
                if (customBlend) {
                    _gl.blendEquation( _gl.FUNC_ADD );
                    _gl.blendFunc( _gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA );    
                }

            }
        },

        _materialSortFunc : function(x, y){
            if ( x.material.shader == y.material.shader) {
                return x.material.__GUID__ - y.material.__GUID__;
            }
            return x.material.shader.__GUID__ - y.material.__GUID__;
        }
    } )


    var matrices = {
        'WORLD' : mat4.create(),
        'VIEW' : mat4.create(),
        'PROJECTION' : mat4.create(),
        'WORLDVIEW' : mat4.create(),
        'VIEWPROJECTION' : mat4.create(),
        'WORLDVIEWPROJECTION' : mat4.create(),

        'WORLDINVERSE' : mat4.create(),
        'VIEWINVERSE' : mat4.create(),
        'PROJECTIONINVERSE' : mat4.create(),
        'WORLDVIEWINVERSE' : mat4.create(),
        'VIEWPROJECTIONINVERSE' : mat4.create(),
        'WORLDVIEWPROJECTIONINVERSE' : mat4.create(),

        'WORLDTRANSPOSE' : mat4.create(),
        'VIEWTRANSPOSE' : mat4.create(),
        'PROJECTIONTRANSPOSE' : mat4.create(),
        'WORLDVIEWTRANSPOSE' : mat4.create(),
        'VIEWPROJECTIONTRANSPOSE' : mat4.create(),
        'WORLDVIEWPROJECTIONTRANSPOSE' : mat4.create(),
        'WORLDINVERSETRANSPOSE' : mat4.create(),
        'VIEWINVERSETRANSPOSE' : mat4.create(),
        'PROJECTIONINVERSETRANSPOSE' : mat4.create(),
        'WORLDVIEWINVERSETRANSPOSE' : mat4.create(),
        'VIEWPROJECTIONINVERSETRANSPOSE' : mat4.create(),
        'WORLDVIEWPROJECTIONINVERSETRANSPOSE' : mat4.create()
    };

    return Renderer;
} );
define('3d/skeleton',['require','core/base','core/matrix4'], function(require){

    var Base = require("core/base");
    var Matrix4 = require("core/matrix4");

    var Skeleton = Base.derive(function(){
        return {
            // Root bones
            roots : [],
            bones : [],
            // Poses stored in arrays

            // Matrix to joint space(inverse of indentity bone world matrix)
            _jointMatrices : [],

            // jointMatrix * currentPoseMatrix
            // worldMatrix is relative to the root bone
            // still in model space not world space
            _boneMatrices : [],

            _boneMatricesArray : null
        }
    }, function(){
        this.updateHierarchy();
        this.updateJointMatrices();
    }, {

        updateHierarchy : function(){
            this.roots = [];
            var bones = this.bones;
            for(var i = 0; i < bones.length; i++){
                var bone = bones[i];
                if(bone.parentIndex >= 0){
                    var parent = bones[bone.parentIndex];
                    parent.add(bone);
                }else{
                    this.roots.push(bone);
                }
            }
        },

        updateJointMatrices : function(){
            for(var i = 0; i < this.roots.length; i++){
                this.roots[i].update();
            }
            for(var i = 0; i < this.bones.length; i++){
                var bone = this.bones[i];
                this._jointMatrices[i] = (new Matrix4()).copy(bone.worldMatrix).invert();
                this._boneMatrices[i] = new Matrix4();
            }
        },

        update : function(){
            for(var i = 0; i < this.roots.length; i++){
                this.roots[i].update();
            }
            var boneMatricesArray = this.getBoneMatricesArray();
            var cursor = 0;
            for(var i = 0; i < this.bones.length; i++){
                var matrixCurrentPose = this.bones[i].worldMatrix;
                this._boneMatrices[i].copy(matrixCurrentPose).multiply(this._jointMatrices[i]);

                for(var j = 0; j < 16; j++){
                    var array = this._boneMatrices[i]._array;
                    boneMatricesArray[cursor++] = array[j];
                }
            }
        },

        getBoneMatricesArray : function(){
            if( ! this._boneMatricesArray ){
                this._boneMatricesArray = new Float32Array(this.bones.length * 16);
            }
            return this._boneMatricesArray;
        },

        setPose : function(time){
            for(var i = 0; i < this.bones.length; i++){
                this.bones[i].setPose(time);
            }
            this.update();
        }
    });

    return Skeleton;
} );
/**
 *
 * @export{object} mesh
 */
define('3d/util/mesh',['require','../geometry','../mesh','glmatrix','_'], function( require ){
    
    var Geometry = require("../geometry");
    var Mesh = require("../mesh");
    var glMatrix = require("glmatrix");
    var _ = require("_");
    var mat4 = glMatrix.mat4;
    var vec3 = glMatrix.vec3;

    var ret = {
        /**
         * Merge multiple meshes to one.
         * Note that these meshes must have the same material
         */
        merge : function( meshes, clone ){

            if( ! meshes.length ){
                return;
            }
            var clone = typeof(clone) === "undefined" ? true : clone;

            var templateMesh = meshes[0];
            var templateGeo = templateMesh.geometry;
            var material = templateMesh.material;

            if( _.any( meshes, function(mesh){
                return mesh.material !== material;  
            }) ){
                console.warn("Material of meshes to merge is not the same, program will use the material of first mesh by default");
            }

            var geometry = new Geometry,
                faces = geometry.faces;

            for(var name in templateGeo.attributes){
                var attr = templateGeo.attributes[name];
                // Extend custom attributes
                if( ! geometry.attributes[name] ){
                    geometry.attributes[name] = {
                        value : [],
                        type : attr.type
                    }
                }
            }


            var faceOffset = 0,
                useFaces = templateGeo.faces.length !== 0;
                
            for( var k = 0; k < meshes.length; k++){
                var mesh = meshes[k];  
                var currentGeo = mesh.geometry;

                mesh.updateMatrix();
                var vertexCount = currentGeo.getVerticesNumber();

                for(var name in currentGeo.attributes ){

                    var currentAttr = currentGeo.attributes[name];
                    var targetAttr = geometry.attributes[name];
                    // Skip the unused attributes;
                    if( ! currentAttr.value.length ){
                        continue;
                    }
                    for(var i = 0; i < vertexCount; i++){

                        // Transform position, normal and tangent
                        if( name === "position" ){
                            var newValue = cloneValue(currentAttr.value[i]);
                            vec3.transformMat4(newValue, newValue, mesh.matrix._array);
                            targetAttr.value.push( newValue );   
                        }
                        else if( name === "normal" ){
                            var newValue = cloneValue(currentAttr.value[i]);
                            targetAttr.value.push( newValue );
                        }
                        else if( name === "tangent" ){
                            var newValue = cloneValue(currentAttr.value[i]);
                            targetAttr.value.push( newValue );
                        }else{
                            targetAttr.value.push( cloneValue(currentAttr.value[i]) );
                        }

                    }
                }

                if( useFaces ){
                    var len = currentGeo.faces.length;
                    for(i =0; i < len; i++){
                        var newFace = [];
                        var face = currentGeo.faces[i];
                        newFace[0] = face[0] + faceOffset;
                        newFace[1] = face[1] + faceOffset;
                        newFace[2] = face[2] + faceOffset;

                        faces.push( newFace );
                    }
                }

                faceOffset += vertexCount;
            }

            function cloneValue( val ){
                if( ! clone ){
                    return val;
                }
                return val && Array.prototype.slice.call(val);
            }

            return new Mesh({
                material : material,
                geometry : geometry
            });
        }
    }

    return ret;
} );
/**
 * 缓动代码来自 https://github.com/sole/tween.js/blob/master/src/Tween.js
 * author: lang(shenyi01@baidu.com)
 */
define('animation/easing',[],function() {
    var Easing = {
        Linear: function(k) {
            return k;
        },

        QuadraticIn: function(k) {
            return k * k;
        },
        QuadraticOut: function(k) {
            return k * (2 - k);
        },
        QuadraticInOut: function(k) {
            if ((k *= 2) < 1) {
                return 0.5 * k * k;
            }
            return - 0.5 * (--k * (k - 2) - 1);
        },

        CubicIn: function(k) {
            return k * k * k;
        },
        CubicOut: function(k) {
            return --k * k * k + 1;
        },
        CubicInOut: function(k) {
            if ((k *= 2) < 1) {
                return 0.5 * k * k * k;
            }
            return 0.5 * ((k -= 2) * k * k + 2);
        },

        QuarticIn: function(k) {
            return k * k * k * k;
        },
        QuarticOut: function(k) {
            return 1 - (--k * k * k * k);
        },
        QuarticInOut: function(k) {
            if ((k *= 2) < 1) {
                return 0.5 * k * k * k * k;
            }
            return - 0.5 * ((k -= 2) * k * k * k - 2);
        },

        QuinticIn: function(k) {
            return k * k * k * k * k;
        },

        QuinticOut: function(k) {
            return --k * k * k * k * k + 1;
        },
        QuinticInOut: function(k) {
            if ((k *= 2) < 1) {
                return 0.5 * k * k * k * k * k;
            }
            return 0.5 * ((k -= 2) * k * k * k * k + 2);
        },

        SinusoidalIn: function(k) {
            return 1 - Math.cos(k * Math.PI / 2);
        },
        SinusoidalOut: function(k) {
            return Math.sin(k * Math.PI / 2);
        },
        SinusoidalInOut: function(k) {
            return 0.5 * (1 - Math.cos(Math.PI * k));
        },

        ExponentialIn: function(k) {
            return k === 0 ? 0 : Math.pow(1024, k - 1);
        },
        ExponentialOut: function(k) {
            return k === 1 ? 1 : 1 - Math.pow(2, - 10 * k);
        },
        ExponentialInOut: function(k) {
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            if ((k *= 2) < 1) {
                return 0.5 * Math.pow(1024, k - 1);
            }
            return 0.5 * (- Math.pow(2, - 10 * (k - 1)) + 2);
        },

        CircularIn: function(k) {
            return 1 - Math.sqrt(1 - k * k);
        },
        CircularOut: function(k) {
            return Math.sqrt(1 - (--k * k));
        },
        CircularInOut: function(k) {
            if ((k *= 2) < 1) {
                return - 0.5 * (Math.sqrt(1 - k * k) - 1);
            }
            return 0.5 * (Math.sqrt(1 - (k -= 2) * k) + 1);
        },

        ElasticIn: function(k) {
            var s, a = 0.1, p = 0.4;
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            if (!a || a < 1) {
                a = 1; s = p / 4;
            }else{
                s = p * Math.asin(1 / a) / (2 * Math.PI);
            }
            return - (a * Math.pow(2, 10 * (k -= 1)) *
                        Math.sin((k - s) * (2 * Math.PI) / p));
        },
        ElasticOut: function(k) {
            var s, a = 0.1, p = 0.4;
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            if (!a || a < 1) {
                a = 1; s = p / 4;
            }
            else{
                s = p * Math.asin(1 / a) / (2 * Math.PI);
            }
            return (a * Math.pow(2, - 10 * k) *
                    Math.sin((k - s) * (2 * Math.PI) / p) + 1);
        },
        ElasticInOut: function(k) {
            var s, a = 0.1, p = 0.4;
            if (k === 0) {
                return 0;
            }
            if (k === 1) {
                return 1;
            }
            if (!a || a < 1) {
                a = 1; s = p / 4;
            }
            else{
                s = p * Math.asin(1 / a) / (2 * Math.PI);
            }
            if ((k *= 2) < 1) {
                return - 0.5 * (a * Math.pow(2, 10 * (k -= 1))
                    * Math.sin((k - s) * (2 * Math.PI) / p));
            }
            return a * Math.pow(2, -10 * (k -= 1))
                    * Math.sin((k - s) * (2 * Math.PI) / p) * 0.5 + 1;

        },

        BackIn: function(k) {
            var s = 1.70158;
            return k * k * ((s + 1) * k - s);
        },
        BackOut: function(k) {
            var s = 1.70158;
            return --k * k * ((s + 1) * k + s) + 1;
        },
        BackInOut: function(k) {
            var s = 1.70158 * 1.525;
            if ((k *= 2) < 1) {
                return 0.5 * (k * k * ((s + 1) * k - s));
            }
            return 0.5 * ((k -= 2) * k * ((s + 1) * k + s) + 2);
        },

        BounceIn: function(k) {
            return 1 - Easing.BounceOut(1 - k);
        },
        BounceOut: function(k) {
            if (k < (1 / 2.75)) {
                return 7.5625 * k * k;
            }
            else if (k < (2 / 2.75)) {
                return 7.5625 * (k -= (1.5 / 2.75)) * k + 0.75;
            } else if (k < (2.5 / 2.75)) {
                return 7.5625 * (k -= (2.25 / 2.75)) * k + 0.9375;
            } else {
                return 7.5625 * (k -= (2.625 / 2.75)) * k + 0.984375;
            }
        },
        BounceInOut: function(k) {
            if (k < 0.5) {
                return Easing.BounceIn(k * 2) * 0.5;
            }
            return Easing.BounceOut(k * 2 - 1) * 0.5 + 0.5;
        }
    };

    return Easing;
});


define('animation/controller',['require','./easing'],function(require) {

    var Easing = require('./easing');

    var Controller = function(options) {

        this._targetPool = options.target || {};
        if (this._targetPool.constructor != Array) {
            this._targetPool = [this._targetPool];
        }

        this._life = options.life || 1000;

        this._delay = options.delay || 0;
        
        this._startTime = new Date().getTime() + this._delay;

        this._endTime = this._startTime + this._life*1000;

        this.loop = typeof(options.loop) == 'undefined'
                    ? false : options.loop;

        this.gap = options.gap || 0;

        this.easing = options.easing || 'Linear';

        this.onframe = options.onframe || null;

        this.ondestroy = options.ondestroy || null;

        this.onrestart = options.onrestart || null;
    };

    Controller.prototype = {
        step : function(time) {
            var percent = (time - this._startTime) / this._life;

            if (percent < 0) {
                return;
            }

            percent = Math.min(percent, 1);

            var easingFunc = typeof(this.easing) == 'string'
                             ? Easing[this.easing]
                             : this.easing;
            var schedule;
            if (typeof easingFunc === 'function') {
                schedule = easingFunc(percent);
            }else{
                schedule = percent;
            }
            this.fire('frame', schedule);

            if (percent == 1) {
                if (this.loop) {
                    this.restart();
                    return 'restart';

                }else{
                    // Mark this controller to be deleted
                    // In the animation.update
                    this._needsRemove = true;

                    return 'destroy';
                }
            }else{
                return null;
            }
        },
        restart : function() {
            this._startTime = new Date().getTime() + this.gap;
        },
        fire : function(eventType, arg) {
            for(var i = 0, len = this._targetPool.length; i < len; i++) {
                if (this['on' + eventType]) {
                    this['on' + eventType](this._targetPool[i], arg);
                }
            }
        }
    };
    Controller.prototype.constructor = Controller;

    return Controller;
});
define('animation/animation',['require','./controller','_'],function(require){
    
    var Controller = require('./controller');
    var _ = require("_");

    var Animation = function(options){

        options = options || {};

        this.stage = options.stage || {};

        this.fps = options.fps || 50;

        this.onframe = options.onframe || function(){};

        // private properties
        this._controllerPool = [];

        this._timer = null;
    };

    Animation.prototype = {
        add : function(controller){
            this._controllerPool.push(controller);
        },
        remove : function(controller){
            var idx = this._controllerPool.indexOf(controller);
            if (idx >= 0){
                this._controllerPool.splice(idx, 1);
            }
        },
        update : function(){
            var time = new Date().getTime();
            var cp = this._controllerPool;
            var len = cp.length;

            var deferredEvents = [];
            var deferredCtls = [];
            for(var i = 0; i < len; i++){
                var controller = cp[i];
                var e = controller.step(time);
                // Throw out the events need to be called after
                // stage.update, like destroy
                if( e ){
                    deferredEvents.push(e);
                    deferredCtls.push(controller);
                }
            }
            if (this.stage
                && this.stage.update
                && this._controllerPool.length
            ){
                this.stage.update();
            }

            // Remove the finished controller
            var newArray = [];
            for(var i = 0; i < len; i++){
                if(!cp[i]._needsRemove){
                    newArray.push(cp[i]);
                    cp[i]._needsRemove = false;
                }
            }
            this._controllerPool = newArray;

            len = deferredEvents.length;
            for(var i = 0; i < len; i++){
                deferredCtls[i].fire( deferredEvents[i] );
            }

            this.onframe();

        },
        start : function(){
            if (this._timer){
                clearInterval(this._timer);
            }
            var self = this;
            this._timer = setInterval(function(){
                self.update();
            }, 1000/this.fps);
        },
        stop : function(){
            if (this._timer){
                clearInterval(this._timer);
            }
        },
        clear : function(){
            this._controllerPool = [];
        },
        animate : function(target, loop, getter, setter){
            var deferred = new Deferred(target, loop, getter, setter);
            deferred.animation = this;
            return deferred;
        }
    };
    Animation.prototype.constructor = Animation;

    function _defaultGetter(target, key){
        return target[key];
    }
    function _defaultSetter(target, key, value){
        target[key] = value;
    }
    // Interpolate recursively
    // TODO interpolate objects
    function _interpolate(prevValue, nextValue, percent, target, propName, getter, setter){
         // 遍历数组做插值
        if (prevValue instanceof Array
            && nextValue instanceof Array
        ){
            var minLen = Math.min(prevValue.length, nextValue.length);
            var largerArray;
            var maxLen;
            var result = [];
            if (minLen === prevValue.length){
                maxLen = nextValue.length;
                largerArray = nextValue;
            }else{
                maxLen = prevValue.length;
                largerArray = prevValue.length;
            }
            for(var i = 0; i < minLen; i++){
                // target[propName] as new target,
                // i as new propName
                result.push(_interpolate(
                        prevValue[i],
                        nextValue[i],
                        percent,
                        getter(target, propName),
                        i,
                        getter,
                        setter
                ));
            }
            // Assign the rest
            for(var i = minLen; i < maxLen; i++){
                result.push(largerArray[i]);
            }

            setter(target, propName, result);
        }
        else{
            prevValue = parseFloat(prevValue);
            nextValue = parseFloat(nextValue);
            if (!isNaN(prevValue) && !isNaN(nextValue)){
                var value = (nextValue-prevValue) * percent+prevValue;
                setter(target, propName, value);
                return value;
            }
        }
    }
    function Deferred(target, loop, getter, setter){
        this._tracks = {};
        this._target = target;

        this._loop = loop || false;

        this._getter = getter || _defaultGetter;
        this._setter = setter || _defaultSetter;

        this._controllerCount = 0;

        this._doneList = [];

        this._onframeList = [];

        this._controllerList = [];
    }

    Deferred.prototype = {
        when : function(time /* ms */, props, easing){
            for(var propName in props){
                if (! this._tracks[ propName ]){
                    this._tracks[ propName ] = [];
                    // Initialize value
                    this._tracks[ propName ].push({
                        time : 0,
                        value : this._getter(this._target, propName)
                    });
                }
                this._tracks[ propName ].push({
                    time : time,
                    value : props[ propName ],
                    easing : easing
                });
            }
            return this;
        },
        during : function(callback){
            this._onframeList.push(callback);
            return this;
        },
        start : function(){
            var self = this;
            var delay;
            var track;
            var trackMaxTime;

            function createOnframe(now, next, propName){
                var prevValue = clone(now.value);
                var nextValue = clone(next.value);
                return function(target, schedule){
                    _interpolate(
                        prevValue,
                        nextValue,
                        schedule,
                        target,
                        propName,
                        self._getter,
                        self._setter
                    );
                    for(var i = 0; i < self._onframeList.length; i++){
                        self._onframeList[i](target, schedule);
                    }
                };
            }

            function ondestroy(){
                self._controllerCount--;
                if (self._controllerCount === 0){
                    var len = self._doneList.length;
                    for(var i = 0; i < len; i++){
                        self._doneList[i]();
                    }
                }
            }

            for(var propName in this._tracks){
                delay = 0;
                track = this._tracks[ propName ];
                if (track.length){
                    trackMaxTime = track[ track.length-1].time;
                }else{
                    continue;
                }
                for(var i = 0; i < track.length-1; i++){
                    var now = track[i],
                        next = track[i+1];

                    var controller = new Controller({
                        target : self._target,
                        life : next.time - now.time,
                        delay : delay,
                        loop : self._loop,
                        gap : trackMaxTime - (next.time - now.time),
                        easing : next.easing,
                        onframe : createOnframe(now, next, propName),
                        ondestroy : ondestroy
                    });
                    this._controllerList.push(controller);

                    this._controllerCount++;
                    delay = next.time;

                    self.animation.add(controller);
                }
            }
            return this;
        },
        stop : function(){
            for(var i = 0; i < this._controllerList.length; i++){
                var controller = this._controllerList[i];
                this.animation.remove(controller);
            }
        },
        done : function(func){
            this._doneList.push(func);
            return this;
        }
    };

    function clone(value){
        if (value && value instanceof Array){
            return Array.prototype.slice.call(value);
        }
        else {
            return value;
        }
    }

    return Animation;
});

define('core/event',['require','./base'], function(require){

    var Base = require('./base');

    var Event = Base.derive({
        cancelBubble : false
    }, {
        stopPropagation : function(){
            this.cancelBubble = true;
        }
    })

    Event.throw = function(eventType, target, props){
        var e = new MouseEvent(props);
        e.sourceTarget = target;

        // enable bubble
        while(target && !e.cancelBubble ){
            e.target = target;
            target.trigger(eventType, e);

            target = target.parent;
        }
    }
} );
/**
 *  @export{object} requester
 */
define('core/request',['require'], function(require){

    function get(options){

        var xhr = new XMLHttpRequest();

        xhr.open("get", options.url);
        // With response type set browser can get and put binary data
        // https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest/Sending_and_Receiving_Binary_Data
        // Defautl is text, and it can be set
        // arraybuffer, blob, document, json, text
        xhr.responseType = options.responseType || "text";

        if(options.onprogress){
            //https://developer.mozilla.org/en-US/docs/DOM/XMLHttpRequest/Using_XMLHttpRequest
            xhr.onprogress = function(e){
                if(e.lengthComputable){
                    var percent = e.loaded / e.total;
                    options.onprogress(percent, e.loaded, e.total);
                }else{
                    options.onprogress(null);
                }
            }
        }
        xhr.onload = function(e){
            options.onload && options.onload(xhr.response);
        }
        if(options.onerror){
            xhr.onerror = options.onerror;
        }
        xhr.send(null);
    }

    function put(options){

    }

    return {
        get : get,
        put : put
    }
} );
;
define("core/vector2", function(){});

define('core/vector4',['require','glmatrix'], function(require){

    var glMatrix = require("glmatrix");
    var vec4 = glMatrix.vec4;

    var Vector4 = function(x, y, z, w){
        
        x = x || 0;
        y = y || 0;
        z = z || 0;
        w = w || 0;

        return Object.create(Vector4Proto, {

            x : {
                configurable : false,
                set : function(value){
                    this._array[0] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[0];
                }
            },
            y : {
                configurable : false,
                set : function(value){
                    this._array[1] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[1];
                }
            },
            z : {
                configurable : false,
                set : function(value){
                    this._array[2] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[2];
                }
            },
            w : {
                configurable : false,
                set : function(value){
                    this._array[2] = value;
                    this._dirty = true;
                },
                get : function(){
                    return this._array[2];
                }
            },

            _array :{
                writable : false,
                configurable : false,
                value : vec4.fromValues(x, y, z, w)
            },
            _dirty : {
                configurable : false,
                value : false
            }
        })

    }

    var Vector4Proto = {

        constructor : Vector4,

        add : function(b){
            vec4.add( this._array, this._array, b._array );
            this._dirty = true;
            return this;
        },

        set : function(x, y, z, w){
            this._array[0] = x;
            this._array[1] = y;
            this._array[2] = z;
            this._array[3] = w;
            this._dirty = true;
            return this;
        },

        clone : function(){
            return new Vector4( this.x, this.y, this.z, this.w);
        },

        copy : function(b){
            vec4.copy( this._array, b._array );
            this._dirty = true;
            return this;
        },

        cross : function(out, b){
            vec4.cross(out._array, this._array, b._array);
            return this;
        },

        dist : function(b){
            return vec4.dist(this._array, b._array);
        },

        distance : function(b){
            return vec4.distance(this._array, b._array);
        },

        div : function(b){
            vec4.div(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        divide : function(b){
            vec4.divide(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        dot : function(b){
            return vec4.dot(this._array, b._array);
        },

        len : function(){
            return vec4.len(this._array);
        },

        length : function(){
            return vec4.length(this._array);
        },
        /**
         * Perform linear interpolation between a and b
         */
        lerp : function(a, b, t){
            vec4.lerp(this._array, a._array, b._array, t);
            this._dirty = true;
            return this;
        },

        mul : function(b){
            vec4.mul(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        multiply : function(b){
            vec4.multiply(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        negate : function(){
            vec4.negate(this._array, this._array);
            this._dirty = true;
            return this;
        },

        normalize : function(){
            vec4.normalize(this._array, this._array);
            this._dirty = true;
            return this;
        },

        random : function(scale){
            vec4.random(this._array, scale);
            this._dirty = true;
            return this;
        },

        scale : function(s){
            vec4.scale(this._array, this._array, s);
            this._dirty = true;
            return this;
        },
        /**
         * add b by a scaled factor
         */
        scaleAndAdd : function(b, s){
            vec4.scaleAndAdd(this._array, this._array, b._array, s);
            this._dirty = true;
            return this;
        },

        sqrDist : function(b){
            return vec4.sqrDist(this._array, b._array);
        },

        squaredDistance : function(b){
            return vec4.squaredDistance(this._array, b._array);
        },

        sqrLen : function(){
            return vec4.sqrLen(this._array);
        },

        squaredLength : function(){
            return vec4.squaredLength(this._array);
        },

        sub : function(b){
            vec4.sub(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        subtract : function(b){
            vec4.subtract(this._array, this._array, b._array);
            this._dirty = true;
            return this;
        },

        transformMat4 : function(m){
            vec4.transformMat4(this._array, this._array, m._array);
            this._dirty = true;
            return this;
        },

        transformQuat : function(q){
            vec4.transformQuat(this._array, this._array, q._array);
            this._dirty = true;
            return this;
        },     

        toString : function(){
            return "[" + Array.prototype.join.call(this._array, ",") + "]";
        }
    }

    return Vector4;
} );
/**
 * Load three.js JSON Format model
 *
 * Format specification : https://github.com/mrdoob/three.js/wiki/JSON-Model-format-3.1
 * @export{class} JSON
 */
define('loader/three/json',['require','core/base','core/request','3d/shader','3d/material','3d/geometry','3d/mesh','3d/node','3d/texture/texture2d','3d/texture/texturecube','3d/shader/library','3d/skeleton','3d/bone','core/vector3','core/quaternion','_','glmatrix'], function(require){

    var Base = require('core/base');

    var request = require("core/request");
    var Shader = require("3d/shader");
    var Material = require("3d/material");
    var Geometry = require("3d/geometry");
    var Mesh = require("3d/mesh");
    var Node = require("3d/node");
    var Texture2D = require("3d/texture/texture2d");
    var TextureCube = require("3d/texture/texturecube");
    var shaderLibrary = require("3d/shader/library");
    var Skeleton = require("3d/skeleton");
    var Bone = require("3d/bone");
    var Vector3 = require("core/vector3");
    var Quaternion = require("core/quaternion");
    var _ = require("_");

    var glMatrix = require("glmatrix");
    var vec3 = glMatrix.vec3;
    var vec2 = glMatrix.vec2;

    var Loader = Base.derive(function(){
        return {
            textureRootPath : "",

            textureNumber : 0
        };
    }, {
        load : function(url){
            var self = this;

            this.textureNumber = 0;
            request.get({
                url : url,
                onprogress : function(percent, loaded, total){
                    self.trigger("progress", percent, loaded, total);
                },
                onerror : function(e){
                    self.trigger("error", e);
                },
                responseType : "text",
                onload : function(data){
                    self.parse( JSON.parse(data) )
                }
            })
        },
        parse : function(data){
            var geometryList = [];
            var cursorList = [];
            
            for(var i = 0; i < data.materials.length; i++){
                geometryList[i] = null;
                cursorList[i] = 0;
            }
            geometryList[0] = new Geometry;

            var faceMaterial = data.materials && data.materials.length > 1;

            var dFaces = data.faces,
                dVertices = data.vertices,
                dNormals = data.normals,
                dColors = data.colors,
                dSkinIndices = data.skinIndices,
                dSkinWeights = data.skinWeights,
                dUvs = data.uvs;

            var skinned = dSkinIndices && dSkinIndices.length
                        && dSkinWeights && dSkinWeights.length;

            var geometry = geometryList[0],
                attributes = geometry.attributes,
                positions = attributes.position.value,
                normals = attributes.normal.value,
                texcoords = [attributes.texcoord0.value,
                            attributes.texcoord1.value],
                colors = attributes.color.value,
                boneIndices = attributes.boneIndex.value,
                boneWeights = attributes.boneWeight.value,
                faces = geometry.faces;

            var nUvLayers = 0;
            if( dUvs[0] && dUvs[0].length ){
                nUvLayers++;
            }
            if( dUvs[1] && dUvs[1].length ){
                nUvLayers++;
            }

            var offset = 0;
            var len = dFaces.length;

            // Cache the reorganized index
            var newIndexMap = [];
            var geoIndexMap = [];
            for(var i = 0; i < dVertices.length; i++){
                newIndexMap[i] = -1;
                geoIndexMap[i] = -1;
            }

            var currentGeometryIndex = 0;
            var isNew = [];
            function getNewIndex(oi, faceIndex){
                if( newIndexMap[oi] >= 0){
                    // Switch to the geometry of existed index 
                    currentGeometryIndex = geoIndexMap[oi];
                    geometry = geometryList[currentGeometryIndex];
                    attributes = geometry.attributes;
                    positions = attributes.position.value;
                    normals = attributes.normal.value;
                    texcoords = [attributes.texcoord0.value,
                                attributes.texcoord1.value];
                    colors = attributes.color.value;
                    boneWeights = attributes.boneWeight.value;
                    boneIndices = attributes.boneIndex.value;

                    isNew[faceIndex] = false;
                    return newIndexMap[oi];
                }else{

                    positions.push( [ dVertices[oi*3], dVertices[oi*3+1], dVertices[oi*3+2] ] );
                    //Skin data
                    if(skinned){
                        boneWeights.push( [dSkinWeights[oi*2], dSkinWeights[oi*2+1], 0] );
                        boneIndices.push( [dSkinIndices[oi*2], dSkinIndices[oi*2+1], -1, -1] );
                    }

                    newIndexMap[oi] = cursorList[materialIndex];
                    geoIndexMap[oi] = materialIndex;

                    isNew[faceIndex] = true;
                    return cursorList[materialIndex]++;
                }
            }
            // Put the vertex data of one face here
            // Incase the program create amount of tmp arrays and cause
            // GC bottleneck
            var faceUvs = [];
            var faceNormals = [];
            var faceColors = [];
            for(var i =0; i < 4; i++){
                faceUvs[i] = [0, 0];
                faceNormals[i] = [0, 0, 0];
                faceColors[i] = [0, 0, 0];
            }
            var materialIndex = 0;

            while(offset < len){
                var type = dFaces[offset++];
                var isQuad = isBitSet( type, 0 ),
                    hasMaterial = isBitSet( type, 1 ),
                    hasFaceUv = isBitSet( type, 2 ),
                    hasFaceVertexUv = isBitSet( type, 3 ),
                    hasFaceNormal = isBitSet( type, 4 ),
                    hasFaceVertexNormal = isBitSet( type, 5 ),
                    hasFaceColor = isBitSet( type, 6 ),
                    hasFaceVertexColor = isBitSet( type, 7 );

                var nVertices = isQuad ? 4 : 3;

                if(hasMaterial){
                    materialIndex = dFaces[ offset+ (isQuad ? 4 : 3) ];
                    if( ! geometryList[materialIndex] ){
                        geometryList[materialIndex] = new Geometry;
                    }
                    geometry = geometryList[materialIndex];
                    attributes = geometry.attributes;
                    positions = attributes.position.value;
                    normals = attributes.normal.value;
                    texcoords = [attributes.texcoord0.value,
                                attributes.texcoord1.value];
                    colors = attributes.color.value;
                    boneWeights = attributes.boneWeight.value;
                    boneIndices = attributes.boneIndex.value;
                    faces = geometry.faces;
                }
                if(isQuad){
                    // Split into two triangle faces, 1-2-4 and 2-3-4
                    var i1o = dFaces[offset++],
                        i2o = dFaces[offset++],
                        i3o = dFaces[offset++],
                        i4o = dFaces[offset++];
                    // Face1
                    var i1 = getNewIndex(i1o, 0),
                        i2 = getNewIndex(i2o, 1),
                        i3 = getNewIndex(i4o, 2),
                    // Face2
                        i4 = getNewIndex(i2o, 3),
                        i5 = getNewIndex(i3o, 4),
                        i6 = getNewIndex(i4o, 5);
                    faces.push([i1, i2, i3], [i4, i5, i6]);
                }else{
                    var i1 = dFaces[offset++],
                        i2 = dFaces[offset++],
                        i3 = dFaces[offset++];
                    i1 = getNewIndex(i1, 0);
                    i2 = getNewIndex(i2, 1);
                    i3 = getNewIndex(i3, 2);
                    faces.push([i1, i2, i3]);
                }
                if(hasMaterial){
                    offset++;
                }
                if(hasFaceUv){
                    for(var i = 0; i < nUvLayers; i++){
                        var uvLayer = dUvs[i];
                        var uvIndex = faces[offset++];
                        var u = uvLayer[uvIndex*2];
                        var v = uvLayer[uvIndex*2+1];
                        if(isQuad){
                            // Random write of array seems not slow
                            // http://jsperf.com/random-vs-sequence-array-set
                            isNew[0] && (texcoords[i][i1] = [u, v]);
                            isNew[1] && (texcoords[i][i2] = [u, v]);
                            isNew[2] && (texcoords[i][i3] = [u, v]);
                            isNew[3] && (texcoords[i][i4] = [u, v]);
                            isNew[4] && (texcoords[i][i5] = [u, v]);
                            isNew[5] && (texcoords[i][i6] = [u, v]);
                        }else{
                            isNew[0] && (texcoords[i][i1] = [u, v]);
                            isNew[1] && (texcoords[i][i2] = [u, v]);
                            isNew[2] && (texcoords[i][i3] = [u, v]);
                        }
                    }
                }
                if(hasFaceVertexUv){
                    for(var i = 0; i < nUvLayers; i++){
                        var uvLayer = dUvs[i];
                        for(var j = 0; j < nVertices; j++){
                            var uvIndex = dFaces[offset++];
                            faceUvs[j][0] = uvLayer[uvIndex*2];
                            faceUvs[j][1] = uvLayer[uvIndex*2+1];
                        }
                        if(isQuad){
                            // Use array slice to clone array is incredibly faster than 
                            // Construct from Float32Array
                            // http://jsperf.com/typedarray-v-s-array-clone/2
                            isNew[0] && (texcoords[i][i1] = faceUvs[0].slice());
                            isNew[1] && (texcoords[i][i2] = faceUvs[1].slice());
                            isNew[2] && (texcoords[i][i3] = faceUvs[3].slice());
                            isNew[3] && (texcoords[i][i4] = faceUvs[1].slice());
                            isNew[4] && (texcoords[i][i5] = faceUvs[2].slice());
                            isNew[5] && (texcoords[i][i6] = faceUvs[3].slice());
                        }else{
                            isNew[0] && (texcoords[i][i1] = faceUvs[0].slice());
                            isNew[1] && (texcoords[i][i2] = faceUvs[1].slice());
                            isNew[2] && (texcoords[i][i3] = faceUvs[2].slice());
                        }
                    }
                }
                if(hasFaceNormal){
                    var normalIndex = dFaces[offset++]*3;
                    var x = dNormals[normalIndex++];
                    var y = dNormals[normalIndex++];
                    var z = dNormals[normalIndex];
                    if(isQuad){
                        isNew[0] && (normals[i1] = [x, y, z]);
                        isNew[1] && (normals[i2] = [x, y, z]);
                        isNew[2] && (normals[i3] = [x, y, z]);
                        isNew[3] && (normals[i4] = [x, y, z]);
                        isNew[4] && (normals[i5] = [x, y, z]);
                        isNew[5] && (normals[i6] = [x, y, z]);
                    }else{
                        isNew[0] && (normals[i1] = [x, y, z]);
                        isNew[1] && (normals[i2] = [x, y, z]);
                        isNew[2] && (normals[i3] = [x, y, z]);
                    }
                }
                if(hasFaceVertexNormal){
                    for(var i = 0; i < nVertices; i++){
                        var normalIndex = dFaces[offset++]*3;
                        faceNormals[i][0] = dNormals[normalIndex++];
                        faceNormals[i][1] = dNormals[normalIndex++];
                        faceNormals[i][2] = dNormals[normalIndex];
                    }
                    if(isQuad){
                        isNew[0] && (normals[i1] = faceNormals[0].slice());
                        isNew[1] && (normals[i2] = faceNormals[1].slice());
                        isNew[2] && (normals[i3] = faceNormals[3].slice());
                        isNew[3] && (normals[i4] = faceNormals[1].slice());
                        isNew[4] && (normals[i5] = faceNormals[2].slice());
                        isNew[5] && (normals[i6] = faceNormals[3].slice());
                    }else{
                        isNew[0] && (normals[i1] = faceNormals[0].slice());
                        isNew[1] && (normals[i2] = faceNormals[1].slice());
                        isNew[2] && (normals[i3] = faceNormals[2].slice());
                    }
                }
                if(hasFaceColor){
                    var colorIndex = dFaces[offset++];
                    var color = hex2rgb(dColors[colorIndex]);
                    if(isQuad){
                        // Does't clone the color here
                        isNew[0] && (colors[i1] = color);
                        isNew[1] && (colors[i2] = color);
                        isNew[2] && (colors[i3] = color);
                        isNew[3] && (colors[i4] = color);
                        isNew[4] && (colors[i5] = color);
                        isNew[5] && (colors[i6] = color);
                    }else{
                        isNew[0] && (colors[i1] = color);
                        isNew[1] && (colors[i2] = color);
                        isNew[2] && (colors[i3] = color);
                    }
                }
                if(hasFaceVertexColor){
                    for(var i = 0; i < nVertices; i++){
                        var colorIndex = dFaces[offset++];
                        faceColors[i] = hex2rgb(dColors[colorIndex]);
                    }
                    if(isQuad){
                        isNew[0] && (colors[i1] = faceColors[0].slice());
                        isNew[1] && (colors[i2] = faceColors[1].slice());
                        isNew[2] && (colors[i3] = faceColors[3].slice());
                        isNew[3] && (colors[i4] = faceColors[1].slice());
                        isNew[4] && (colors[i5] = faceColors[2].slice());
                        isNew[5] && (colors[i6] = faceColors[3].slice());
                    }else{
                        isNew[0] && (colors[i1] = faceColors[0].slice());
                        isNew[1] && (colors[i2] = faceColors[1].slice());
                        isNew[2] && (colors[i3] = faceColors[2].slice());
                    }
                }
            }

            if(skinned){
                var skeleton = this.parseSkeleton(data);
                var boneNumber = skeleton.bones.length;
            }else{
                var boneNumber = 0;
            }

            var meshList = [];
            for(var i = 0; i < data.materials.length; i++){
                var geometry = geometryList[i];
                if( geometry 
                    && geometry.faces.length 
                    && geometry.attributes.position.value.length ){
                    var material = this.parseMaterial(data.materials[i], boneNumber);
                    var mesh = new Mesh({
                        geometry : geometryList[i],
                        material : material
                    }) ;
                    if( skinned){
                        mesh.skeleton = skeleton;
                    }
                    meshList.push(mesh);
                }
            }
            
            this.trigger('load', meshList);
            return meshList;
        },

        parseSkeleton : function(data){
            var bones = [];
            var dBones = data.bones;
            for( var i = 0; i < dBones.length; i++){
                var dBone = dBones[i];
                var bone = new Bone({
                    parentIndex : dBone.parent,
                    name : dBone.name,
                    position : new Vector3(dBone.pos[0], dBone.pos[1], dBone.pos[2]),
                    rotation : new Quaternion(dBone.rotq[0], dBone.rotq[1], dBone.rotq[2], dBone.rotq[3]),
                    scale : new Vector3(dBone.scl[0], dBone.scl[1], dBone.scl[2])
                });
                bones.push(bone);
            }

            var skeleton = new Skeleton({
                bones : bones
            });
            skeleton.update();

            if( data.animation){
                var dFrames = data.animation.hierarchy;

                // Parse Animations
                for(var i = 0; i < dFrames.length; i++){
                    var channel = dFrames[i];
                    var bone = bones[i];
                    for(var j = 0; j < channel.keys.length; j++){
                        var key = channel.keys[j];
                        bone.poses[j] = {};
                        var pose = bone.poses[j];
                        pose.time = parseFloat(key.time);
                        if(key.pos){
                            pose.position = new Vector3(key.pos[0], key.pos[1], key.pos[2]);
                        }
                        if(key.rot){
                            pose.rotation = new Quaternion(key.rot[0], key.rot[1], key.rot[2], key.rot[3]);
                        }
                        if(key.scl){
                            pose.scale = new Vector3(key.scl[0], key.scl[1], key.scl[2]);
                        }
                    }
                }
            }

            return skeleton;
        },

        parseMaterial : function(mConfig, boneNumber){
            var shaderName = "buildin.lambert";
            var shading = mConfig.shading && mConfig.shading.toLowerCase();
            if( shading === "phong" || shading === "lambert"){
                shaderName = "buildin." + shading;
            }
            var enabledTextures = [];
            if( mConfig.mapDiffuse ){
                enabledTextures.push("diffuseMap");
            }
            if( mConfig.mapNormal || mConfig.mapBump ){
                enabledTextures.push('normalMap');
            }
            if(boneNumber == 0){
                var shader = shaderLibrary.get(shaderName, enabledTextures);
            }else{
                // Shader for skinned mesh
                var shader = new Shader({
                    vertex : Shader.source(shaderName+".vertex"),
                    fragment : Shader.source(shaderName+".fragment")
                })
                for(var i = 0; i < enabledTextures; i++){
                    shader.enableTexture(enabledTextures[i]);
                }
                shader.vertexDefines["SKINNING"] = null;
                shader.vertexDefines["BONE_MATRICES_NUMBER"] = boneNumber;
            }

            var material = new Material({
                shader : shader
            });
            if( mConfig.colorDiffuse ){
                material.setUniform("color", mConfig.colorDiffuse );
            }else if( mConfig.DbgColor){
                material.setUniform("color", hex2rgb(mConfig.DbgColor));
            }
            if( mConfig.colorSpecular ){
                material.setUniform("specular", mConfig.colorSpecular );
            }
            if(mConfig.transparent !== undefined && mConfig.transparent){
                material.transparent = true;
            }
            if( ! _.isUndefined(mConfig.depthTest)){
                material.depthTest = mConfig.depthTest;
            }
            if( ! _.isUndefined(mConfig.depthWrite)){
                material.depthTest = mConfig.depthWrite;
            }
            
            if(mConfig.transparency && mConfig.transparency < 1){
                material.setUniform("opacity", mConfig.transparency);
            }
            if(mConfig.specularCoef){
                material.setUniform("shininess", mConfig.specularCoef);
            }

            // Textures
            if( mConfig.mapDiffuse ){
                material.setUniform("diffuseMap", this.loadTexture(mConfig.mapDiffuse, mConfig.mapDiffuseWrap) );
            }
            if( mConfig.mapBump){
                material.setUniform("normalMap", this.loadTexture(mConfig.mapBump, mConfig.mapBumpWrap) );
            }
            if( mConfig.mapNormal){
                material.setUniform("normalMap", this.loadTexture(mConfig.mapNormal, mConfig.mapBumpWrap) );
            }

            return material;
        },

        loadTexture : function(path, wrap){
            var self = this;

            var img = new Image();
            var texture = new Texture2D();
            texture.image = img;

            this.textureNumber++;

            if( wrap && wrap.length ){
                texture.wrapS = wrap[0].toUpperCase();
                texture.wrapT = wrap[1].toUpperCase();
            }
            img.onload = function(){
                self.trigger("load:texture", texture);
                texture.dirty();
            }
            img.src = this.textureRootPath + "/" + path;

            return texture;
        }
    })


    function isBitSet(value, position){
        return value & ( 1 << position );
    }


    function hex2rgb(hex){
        var r = (hex >> 16) & 0xff,
            g = (hex >> 8) & 0xff,
            b = hex & 0xff;
        return [r/255, g/255, b/255];
    }

    function translateColor(color){
        return [color[0]/255, color[1]/255, color[2]/255];
    }

    return Loader
} );
define('util/color',['require'], function(require){

	
} );
define('util/xmlparser',['require'], function(require){

});
define('src/qtek',['require','2d/camera','2d/node','2d/renderable/arc','2d/renderable/circle','2d/renderable/image','2d/renderable/line','2d/renderable/path','2d/renderable/polygon','2d/renderable/rectangle','2d/renderable/roundedrectangle','2d/renderable/sector','2d/renderable/text','2d/renderable/textbox','2d/renderer','2d/scene','2d/style','2d/util','3d/bone','3d/camera','3d/camera/orthographic','3d/camera/perspective','3d/compositor','3d/compositor/graph/graph','3d/compositor/graph/node','3d/compositor/graph/scenenode','3d/compositor/graph/texturenode','3d/compositor/graph/texturepool','3d/compositor/pass','3d/debug/pointlight','3d/debug/renderinfo','3d/framebuffer','3d/geometry','3d/geometry/cube','3d/geometry/plane','3d/geometry/sphere','3d/light','3d/light/ambient','3d/light/directional','3d/light/point','3d/light/spot','3d/material','3d/mesh','3d/node','3d/plugin/firstpersoncontrol','3d/plugin/orbitcontrol','3d/prepass/shadowmap','3d/renderer','3d/scene','3d/shader','3d/shader/library','3d/skeleton','3d/texture','3d/texture/texture2d','3d/texture/texturecube','3d/util/mesh','3d/webglinfo','animation/animation','animation/controller','animation/easing','core/base','core/cache','core/event','core/matrix3','core/matrix4','core/mixin/derive','core/mixin/dirty','core/mixin/notifier','core/quaternion','core/request','core/vector2','core/vector3','core/vector4','loader/three/json','text','util/color','util/util','util/xmlparser','glmatrix'], function(require){
	
	var exportsObject =  {
	"2d": {
		"Camera": require('2d/camera'),
		"Node": require('2d/node'),
		"renderable": {
			"Arc": require('2d/renderable/arc'),
			"Circle": require('2d/renderable/circle'),
			"Image": require('2d/renderable/image'),
			"Line": require('2d/renderable/line'),
			"Path": require('2d/renderable/path'),
			"Polygon": require('2d/renderable/polygon'),
			"Rectangle": require('2d/renderable/rectangle'),
			"RoundedRectangle": require('2d/renderable/roundedrectangle'),
			"Sector": require('2d/renderable/sector'),
			"Text": require('2d/renderable/text'),
			"TextBox": require('2d/renderable/textbox')
		},
		"Renderer": require('2d/renderer'),
		"Scene": require('2d/scene'),
		"Style": require('2d/style'),
		"util": require('2d/util')
	},
	"3d": {
		"Bone": require('3d/bone'),
		"Camera": require('3d/camera'),
		"camera": {
			"Orthographic": require('3d/camera/orthographic'),
			"Perspective": require('3d/camera/perspective')
		},
		"Compositor": require('3d/compositor'),
		"compositor": {
			"graph": {
				"Graph": require('3d/compositor/graph/graph'),
				"Node": require('3d/compositor/graph/node'),
				"SceneNode": require('3d/compositor/graph/scenenode'),
				"TextureNode": require('3d/compositor/graph/texturenode'),
				"Texturepool": require('3d/compositor/graph/texturepool')
			},
			"Pass": require('3d/compositor/pass')
		},
		"debug": {
			"Pointlight": require('3d/debug/pointlight'),
			"RenderInfo": require('3d/debug/renderinfo')
		},
		"FrameBuffer": require('3d/framebuffer'),
		"Geometry": require('3d/geometry'),
		"geometry": {
			"Cube": require('3d/geometry/cube'),
			"Plane": require('3d/geometry/plane'),
			"Sphere": require('3d/geometry/sphere')
		},
		"Light": require('3d/light'),
		"light": {
			"Ambient": require('3d/light/ambient'),
			"Directional": require('3d/light/directional'),
			"Point": require('3d/light/point'),
			"Spot": require('3d/light/spot')
		},
		"Material": require('3d/material'),
		"Mesh": require('3d/mesh'),
		"Node": require('3d/node'),
		"plugin": {
			"FirstPersonControl": require('3d/plugin/firstpersoncontrol'),
			"OrbitControl": require('3d/plugin/orbitcontrol')
		},
		"prepass": {
			"ShadowMap": require('3d/prepass/shadowmap')
		},
		"Renderer": require('3d/renderer'),
		"Scene": require('3d/scene'),
		"Shader": require('3d/shader'),
		"shader": {
			"library": require('3d/shader/library')
		},
		"Skeleton": require('3d/skeleton'),
		"Texture": require('3d/texture'),
		"texture": {
			"Texture2D": require('3d/texture/texture2d'),
			"TextureCube": require('3d/texture/texturecube')
		},
		"util": {
			"mesh": require('3d/util/mesh')
		},
		"WebGLInfo": require('3d/webglinfo')
	},
	"animation": {
		"Animation": require('animation/animation'),
		"Controller": require('animation/controller'),
		"Easing": require('animation/easing')
	},
	"core": {
		"Base": require('core/base'),
		"Cache": require('core/cache'),
		"Event": require('core/event'),
		"Matrix3": require('core/matrix3'),
		"Matrix4": require('core/matrix4'),
		"mixin": {
			"derive": require('core/mixin/derive'),
			"Dirty": require('core/mixin/dirty'),
			"notifier": require('core/mixin/notifier')
		},
		"Quaternion": require('core/quaternion'),
		"requester": require('core/request'),
		"Vector2": require('core/vector2'),
		"Vector3": require('core/vector3'),
		"Vector4": require('core/vector4')
	},
	"loader": {
		"three": {
			"JSON": require('loader/three/json')
		}
	},
	"Text": require('text'),
	"util": {
		"Color": require('util/color'),
		"Util": require('util/util'),
		"Xmlparser": require('util/xmlparser')
	}
};

    var glMatrix = require('glmatrix');
    exportsObject.math = glMatrix;
    
    return exportsObject;
});
var qtek = require("src/qtek");

for(var name in qtek){
	_exports[name] = qtek[name];
}

})