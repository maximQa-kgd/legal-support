//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

/*!
 * JavaScript Cookie v2.2.0
 * https://github.com/js-cookie/js-cookie
 *
 * Copyright 2006, 2015 Klaus Hartl & Fagner Brack
 * Released under the MIT license
 */
;(function (factory) {
	var registeredInModuleLoader = false;
	if (typeof define === 'function' && define.amd) {
		define(factory);
		registeredInModuleLoader = true;
	}
	if (typeof exports === 'object') {
		module.exports = factory();
		registeredInModuleLoader = true;
	}
	if (!registeredInModuleLoader) {
		var OldCookies = window.Cookies;
		var api = window.Cookies = factory();
		api.noConflict = function () {
			window.Cookies = OldCookies;
			return api;
		};
	}
}(function () {
	function extend () {
		var i = 0;
		var result = {};
		for (; i < arguments.length; i++) {
			var attributes = arguments[ i ];
			for (var key in attributes) {
				result[key] = attributes[key];
			}
		}
		return result;
	}

	function init (converter) {
		function api (key, value, attributes) {
			var result;
			if (typeof document === 'undefined') {
				return;
			}

			// Write

			if (arguments.length > 1) {
				attributes = extend({
					path: '/'
				}, api.defaults, attributes);

				if (typeof attributes.expires === 'number') {
					var expires = new Date();
					expires.setMilliseconds(expires.getMilliseconds() + attributes.expires * 864e+5);
					attributes.expires = expires;
				}

				// We're using "expires" because "max-age" is not supported by IE
				attributes.expires = attributes.expires ? attributes.expires.toUTCString() : '';

				try {
					result = JSON.stringify(value);
					if (/^[\{\[]/.test(result)) {
						value = result;
					}
				} catch (e) {}

				if (!converter.write) {
					value = encodeURIComponent(String(value))
						.replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent);
				} else {
					value = converter.write(value, key);
				}

				key = encodeURIComponent(String(key));
				key = key.replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent);
				key = key.replace(/[\(\)]/g, escape);

				var stringifiedAttributes = '';

				for (var attributeName in attributes) {
					if (!attributes[attributeName]) {
						continue;
					}
					stringifiedAttributes += '; ' + attributeName;
					if (attributes[attributeName] === true) {
						continue;
					}
					stringifiedAttributes += '=' + attributes[attributeName];
				}
				return (document.cookie = key + '=' + value + stringifiedAttributes);
			}

			// Read

			if (!key) {
				result = {};
			}

			// To prevent the for loop in the first place assign an empty array
			// in case there are no cookies at all. Also prevents odd result when
			// calling "get()"
			var cookies = document.cookie ? document.cookie.split('; ') : [];
			var rdecode = /(%[0-9A-Z]{2})+/g;
			var i = 0;

			for (; i < cookies.length; i++) {
				var parts = cookies[i].split('=');
				var cookie = parts.slice(1).join('=');

				if (!this.json && cookie.charAt(0) === '"') {
					cookie = cookie.slice(1, -1);
				}

				try {
					var name = parts[0].replace(rdecode, decodeURIComponent);
					cookie = converter.read ?
						converter.read(cookie, name) : converter(cookie, name) ||
						cookie.replace(rdecode, decodeURIComponent);

					if (this.json) {
						try {
							cookie = JSON.parse(cookie);
						} catch (e) {}
					}

					if (key === name) {
						result = cookie;
						break;
					}

					if (!key) {
						result[name] = cookie;
					}
				} catch (e) {}
			}

			return result;
		}

		api.set = api;
		api.get = function (key) {
			return api.call(api, key);
		};
		api.getJSON = function () {
			return api.apply({
				json: true
			}, [].slice.call(arguments));
		};
		api.defaults = {};

		api.remove = function (key, attributes) {
			api(key, '', extend(attributes, {
				expires: -1
			}));
		};

		api.withConverter = init;

		return api;
	}

	return init(function () {});
}));

/*!
 * jQuery JavaScript Library v3.4.1
 * https://jquery.com/
 *
 * Includes Sizzle.js
 * https://sizzlejs.com/
 *
 * Copyright JS Foundation and other contributors
 * Released under the MIT license
 * https://jquery.org/license
 *
 * Date: 2019-05-01T21:04Z
 */
( function( global, factory ) {

	"use strict";

	if ( typeof module === "object" && typeof module.exports === "object" ) {

		// For CommonJS and CommonJS-like environments where a proper `window`
		// is present, execute the factory and get jQuery.
		// For environments that do not have a `window` with a `document`
		// (such as Node.js), expose a factory as module.exports.
		// This accentuates the need for the creation of a real `window`.
		// e.g. var jQuery = require("jquery")(window);
		// See ticket #14549 for more info.
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "jQuery requires a window with a document" );
				}
				return factory( w );
			};
	} else {
		factory( global );
	}

// Pass this if window is not defined yet
} )( typeof window !== "undefined" ? window : this, function( window, noGlobal ) {

// Edge <= 12 - 13+, Firefox <=18 - 45+, IE 10 - 11, Safari 5.1 - 9+, iOS 6 - 9.1
// throw exceptions when non-strict code (e.g., ASP.NET 4.5) accesses strict mode
// arguments.callee.caller (trac-13335). But as of jQuery 3.0 (2016), strict mode should be common
// enough that all such attempts are guarded in a try block.
"use strict";

var arr = [];

var document = window.document;

var getProto = Object.getPrototypeOf;

var slice = arr.slice;

var concat = arr.concat;

var push = arr.push;

var indexOf = arr.indexOf;

var class2type = {};

var toString = class2type.toString;

var hasOwn = class2type.hasOwnProperty;

var fnToString = hasOwn.toString;

var ObjectFunctionString = fnToString.call( Object );

var support = {};

var isFunction = function isFunction( obj ) {

      // Support: Chrome <=57, Firefox <=52
      // In some browsers, typeof returns "function" for HTML <object> elements
      // (i.e., `typeof document.createElement( "object" ) === "function"`).
      // We don't want to classify *any* DOM node as a function.
      return typeof obj === "function" && typeof obj.nodeType !== "number";
  };


var isWindow = function isWindow( obj ) {
		return obj != null && obj === obj.window;
	};




	var preservedScriptAttributes = {
		type: true,
		src: true,
		nonce: true,
		noModule: true
	};

	function DOMEval( code, node, doc ) {
		doc = doc || document;

		var i, val,
			script = doc.createElement( "script" );

		script.text = code;
		if ( node ) {
			for ( i in preservedScriptAttributes ) {

				// Support: Firefox 64+, Edge 18+
				// Some browsers don't support the "nonce" property on scripts.
				// On the other hand, just using `getAttribute` is not enough as
				// the `nonce` attribute is reset to an empty string whenever it
				// becomes browsing-context connected.
				// See https://github.com/whatwg/html/issues/2369
				// See https://html.spec.whatwg.org/#nonce-attributes
				// The `node.getAttribute` check was added for the sake of
				// `jQuery.globalEval` so that it can fake a nonce-containing node
				// via an object.
				val = node[ i ] || node.getAttribute && node.getAttribute( i );
				if ( val ) {
					script.setAttribute( i, val );
				}
			}
		}
		doc.head.appendChild( script ).parentNode.removeChild( script );
	}


function toType( obj ) {
	if ( obj == null ) {
		return obj + "";
	}

	// Support: Android <=2.3 only (functionish RegExp)
	return typeof obj === "object" || typeof obj === "function" ?
		class2type[ toString.call( obj ) ] || "object" :
		typeof obj;
}
/* global Symbol */
// Defining this global in .eslintrc.json would create a danger of using the global
// unguarded in another place, it seems safer to define global only for this module



var
	version = "3.4.1",

	// Define a local copy of jQuery
	jQuery = function( selector, context ) {

		// The jQuery object is actually just the init constructor 'enhanced'
		// Need init if jQuery is called (just allow error to be thrown if not included)
		return new jQuery.fn.init( selector, context );
	},

	// Support: Android <=4.0 only
	// Make sure we trim BOM and NBSP
	rtrim = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;

jQuery.fn = jQuery.prototype = {

	// The current version of jQuery being used
	jquery: version,

	constructor: jQuery,

	// The default length of a jQuery object is 0
	length: 0,

	toArray: function() {
		return slice.call( this );
	},

	// Get the Nth element in the matched element set OR
	// Get the whole matched element set as a clean array
	get: function( num ) {

		// Return all the elements in a clean array
		if ( num == null ) {
			return slice.call( this );
		}

		// Return just the one element from the set
		return num < 0 ? this[ num + this.length ] : this[ num ];
	},

	// Take an array of elements and push it onto the stack
	// (returning the new matched element set)
	pushStack: function( elems ) {

		// Build a new jQuery matched element set
		var ret = jQuery.merge( this.constructor(), elems );

		// Add the old object onto the stack (as a reference)
		ret.prevObject = this;

		// Return the newly-formed element set
		return ret;
	},

	// Execute a callback for every element in the matched set.
	each: function( callback ) {
		return jQuery.each( this, callback );
	},

	map: function( callback ) {
		return this.pushStack( jQuery.map( this, function( elem, i ) {
			return callback.call( elem, i, elem );
		} ) );
	},

	slice: function() {
		return this.pushStack( slice.apply( this, arguments ) );
	},

	first: function() {
		return this.eq( 0 );
	},

	last: function() {
		return this.eq( -1 );
	},

	eq: function( i ) {
		var len = this.length,
			j = +i + ( i < 0 ? len : 0 );
		return this.pushStack( j >= 0 && j < len ? [ this[ j ] ] : [] );
	},

	end: function() {
		return this.prevObject || this.constructor();
	},

	// For internal use only.
	// Behaves like an Array's method, not like a jQuery method.
	push: push,
	sort: arr.sort,
	splice: arr.splice
};

jQuery.extend = jQuery.fn.extend = function() {
	var options, name, src, copy, copyIsArray, clone,
		target = arguments[ 0 ] || {},
		i = 1,
		length = arguments.length,
		deep = false;

	// Handle a deep copy situation
	if ( typeof target === "boolean" ) {
		deep = target;

		// Skip the boolean and the target
		target = arguments[ i ] || {};
		i++;
	}

	// Handle case when target is a string or something (possible in deep copy)
	if ( typeof target !== "object" && !isFunction( target ) ) {
		target = {};
	}

	// Extend jQuery itself if only one argument is passed
	if ( i === length ) {
		target = this;
		i--;
	}

	for ( ; i < length; i++ ) {

		// Only deal with non-null/undefined values
		if ( ( options = arguments[ i ] ) != null ) {

			// Extend the base object
			for ( name in options ) {
				copy = options[ name ];

				// Prevent Object.prototype pollution
				// Prevent never-ending loop
				if ( name === "__proto__" || target === copy ) {
					continue;
				}

				// Recurse if we're merging plain objects or arrays
				if ( deep && copy && ( jQuery.isPlainObject( copy ) ||
					( copyIsArray = Array.isArray( copy ) ) ) ) {
					src = target[ name ];

					// Ensure proper type for the source value
					if ( copyIsArray && !Array.isArray( src ) ) {
						clone = [];
					} else if ( !copyIsArray && !jQuery.isPlainObject( src ) ) {
						clone = {};
					} else {
						clone = src;
					}
					copyIsArray = false;

					// Never move original objects, clone them
					target[ name ] = jQuery.extend( deep, clone, copy );

				// Don't bring in undefined values
				} else if ( copy !== undefined ) {
					target[ name ] = copy;
				}
			}
		}
	}

	// Return the modified object
	return target;
};

jQuery.extend( {

	// Unique for each copy of jQuery on the page
	expando: "jQuery" + ( version + Math.random() ).replace( /\D/g, "" ),

	// Assume jQuery is ready without the ready module
	isReady: true,

	error: function( msg ) {
		throw new Error( msg );
	},

	noop: function() {},

	isPlainObject: function( obj ) {
		var proto, Ctor;

		// Detect obvious negatives
		// Use toString instead of jQuery.type to catch host objects
		if ( !obj || toString.call( obj ) !== "[object Object]" ) {
			return false;
		}

		proto = getProto( obj );

		// Objects with no prototype (e.g., `Object.create( null )`) are plain
		if ( !proto ) {
			return true;
		}

		// Objects with prototype are plain iff they were constructed by a global Object function
		Ctor = hasOwn.call( proto, "constructor" ) && proto.constructor;
		return typeof Ctor === "function" && fnToString.call( Ctor ) === ObjectFunctionString;
	},

	isEmptyObject: function( obj ) {
		var name;

		for ( name in obj ) {
			return false;
		}
		return true;
	},

	// Evaluates a script in a global context
	globalEval: function( code, options ) {
		DOMEval( code, { nonce: options && options.nonce } );
	},

	each: function( obj, callback ) {
		var length, i = 0;

		if ( isArrayLike( obj ) ) {
			length = obj.length;
			for ( ; i < length; i++ ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		} else {
			for ( i in obj ) {
				if ( callback.call( obj[ i ], i, obj[ i ] ) === false ) {
					break;
				}
			}
		}

		return obj;
	},

	// Support: Android <=4.0 only
	trim: function( text ) {
		return text == null ?
			"" :
			( text + "" ).replace( rtrim, "" );
	},

	// results is for internal usage only
	makeArray: function( arr, results ) {
		var ret = results || [];

		if ( arr != null ) {
			if ( isArrayLike( Object( arr ) ) ) {
				jQuery.merge( ret,
					typeof arr === "string" ?
					[ arr ] : arr
				);
			} else {
				push.call( ret, arr );
			}
		}

		return ret;
	},

	inArray: function( elem, arr, i ) {
		return arr == null ? -1 : indexOf.call( arr, elem, i );
	},

	// Support: Android <=4.0 only, PhantomJS 1 only
	// push.apply(_, arraylike) throws on ancient WebKit
	merge: function( first, second ) {
		var len = +second.length,
			j = 0,
			i = first.length;

		for ( ; j < len; j++ ) {
			first[ i++ ] = second[ j ];
		}

		first.length = i;

		return first;
	},

	grep: function( elems, callback, invert ) {
		var callbackInverse,
			matches = [],
			i = 0,
			length = elems.length,
			callbackExpect = !invert;

		// Go through the array, only saving the items
		// that pass the validator function
		for ( ; i < length; i++ ) {
			callbackInverse = !callback( elems[ i ], i );
			if ( callbackInverse !== callbackExpect ) {
				matches.push( elems[ i ] );
			}
		}

		return matches;
	},

	// arg is for internal usage only
	map: function( elems, callback, arg ) {
		var length, value,
			i = 0,
			ret = [];

		// Go through the array, translating each of the items to their new values
		if ( isArrayLike( elems ) ) {
			length = elems.length;
			for ( ; i < length; i++ ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}

		// Go through every key on the object,
		} else {
			for ( i in elems ) {
				value = callback( elems[ i ], i, arg );

				if ( value != null ) {
					ret.push( value );
				}
			}
		}

		// Flatten any nested arrays
		return concat.apply( [], ret );
	},

	// A global GUID counter for objects
	guid: 1,

	// jQuery.support is not used in Core but other projects attach their
	// properties to it so it needs to exist.
	support: support
} );

if ( typeof Symbol === "function" ) {
	jQuery.fn[ Symbol.iterator ] = arr[ Symbol.iterator ];
}

// Populate the class2type map
jQuery.each( "Boolean Number String Function Array Date RegExp Object Error Symbol".split( " " ),
function( i, name ) {
	class2type[ "[object " + name + "]" ] = name.toLowerCase();
} );

function isArrayLike( obj ) {

	// Support: real iOS 8.2 only (not reproducible in simulator)
	// `in` check used to prevent JIT error (gh-2145)
	// hasOwn isn't used here due to false negatives
	// regarding Nodelist length in IE
	var length = !!obj && "length" in obj && obj.length,
		type = toType( obj );

	if ( isFunction( obj ) || isWindow( obj ) ) {
		return false;
	}

	return type === "array" || length === 0 ||
		typeof length === "number" && length > 0 && ( length - 1 ) in obj;
}
var Sizzle =
/*!
 * Sizzle CSS Selector Engine v2.3.4
 * https://sizzlejs.com/
 *
 * Copyright JS Foundation and other contributors
 * Released under the MIT license
 * https://js.foundation/
 *
 * Date: 2019-04-08
 */
(function( window ) {

var i,
	support,
	Expr,
	getText,
	isXML,
	tokenize,
	compile,
	select,
	outermostContext,
	sortInput,
	hasDuplicate,

	// Local document vars
	setDocument,
	document,
	docElem,
	documentIsHTML,
	rbuggyQSA,
	rbuggyMatches,
	matches,
	contains,

	// Instance-specific data
	expando = "sizzle" + 1 * new Date(),
	preferredDoc = window.document,
	dirruns = 0,
	done = 0,
	classCache = createCache(),
	tokenCache = createCache(),
	compilerCache = createCache(),
	nonnativeSelectorCache = createCache(),
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
		}
		return 0;
	},

	// Instance methods
	hasOwn = ({}).hasOwnProperty,
	arr = [],
	pop = arr.pop,
	push_native = arr.push,
	push = arr.push,
	slice = arr.slice,
	// Use a stripped-down indexOf as it's faster than native
	// https://jsperf.com/thor-indexof-vs-for/5
	indexOf = function( list, elem ) {
		var i = 0,
			len = list.length;
		for ( ; i < len; i++ ) {
			if ( list[i] === elem ) {
				return i;
			}
		}
		return -1;
	},

	booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",

	// Regular expressions

	// http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = "[\\x20\\t\\r\\n\\f]",

	// http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
	identifier = "(?:\\\\.|[\\w-]|[^\0-\\xa0])+",

	// Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
	attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +
		// Operator (capture 2)
		"*([*^$|!~]?=)" + whitespace +
		// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
		"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace +
		"*\\]",

	pseudos = ":(" + identifier + ")(?:\\((" +
		// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
		// 1. quoted (capture 3; capture 4 or capture 5)
		"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +
		// 2. simple (capture 6)
		"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +
		// 3. anything else (capture 2)
		".*" +
		")\\)|)",

	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
	rwhitespace = new RegExp( whitespace + "+", "g" ),
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),

	rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
	rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*" ),
	rdescend = new RegExp( whitespace + "|>" ),

	rpseudo = new RegExp( pseudos ),
	ridentifier = new RegExp( "^" + identifier + "$" ),

	matchExpr = {
		"ID": new RegExp( "^#(" + identifier + ")" ),
		"CLASS": new RegExp( "^\\.(" + identifier + ")" ),
		"TAG": new RegExp( "^(" + identifier + "|[*])" ),
		"ATTR": new RegExp( "^" + attributes ),
		"PSEUDO": new RegExp( "^" + pseudos ),
		"CHILD": new RegExp( "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace +
			"*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
			"*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
		"bool": new RegExp( "^(?:" + booleans + ")$", "i" ),
		// For use in libraries implementing .is()
		// We use this for POS matching in `select`
		"needsContext": new RegExp( "^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
			whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
	},

	rhtml = /HTML$/i,
	rinputs = /^(?:input|select|textarea|button)$/i,
	rheader = /^h\d$/i,

	rnative = /^[^{]+\{\s*\[native \w/,

	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

	rsibling = /[+~]/,

	// CSS escapes
	// http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
	runescape = new RegExp( "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig" ),
	funescape = function( _, escaped, escapedWhitespace ) {
		var high = "0x" + escaped - 0x10000;
		// NaN means non-codepoint
		// Support: Firefox<24
		// Workaround erroneous numeric interpretation of +"0x"
		return high !== high || escapedWhitespace ?
			escaped :
			high < 0 ?
				// BMP codepoint
				String.fromCharCode( high + 0x10000 ) :
				// Supplemental Plane codepoint (surrogate pair)
				String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
	},

	// CSS string/identifier serialization
	// https://drafts.csswg.org/cssom/#common-serializing-idioms
	rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\0-\x1f\x7f-\uFFFF\w-]/g,
	fcssescape = function( ch, asCodePoint ) {
		if ( asCodePoint ) {

			// U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
			if ( ch === "\0" ) {
				return "\uFFFD";
			}

			// Control characters and (dependent upon position) numbers get escaped as code points
			return ch.slice( 0, -1 ) + "\\" + ch.charCodeAt( ch.length - 1 ).toString( 16 ) + " ";
		}

		// Other potentially-special ASCII characters get backslash-escaped
		return "\\" + ch;
	},

	// Used for iframes
	// See setDocument()
	// Removing the function wrapper causes a "Permission Denied"
	// error in IE
	unloadHandler = function() {
		setDocument();
	},

	inDisabledFieldset = addCombinator(
		function( elem ) {
			return elem.disabled === true && elem.nodeName.toLowerCase() === "fieldset";
		},
		{ dir: "parentNode", next: "legend" }
	);

// Optimize for push.apply( _, NodeList )
try {
	push.apply(
		(arr = slice.call( preferredDoc.childNodes )),
		preferredDoc.childNodes
	);
	// Support: Android<4.0
	// Detect silently failing push.apply
	arr[ preferredDoc.childNodes.length ].nodeType;
} catch ( e ) {
	push = { apply: arr.length ?

		// Leverage slice if possible
		function( target, els ) {
			push_native.apply( target, slice.call(els) );
		} :

		// Support: IE<9
		// Otherwise append directly
		function( target, els ) {
			var j = target.length,
				i = 0;
			// Can't trust NodeList.length
			while ( (target[j++] = els[i++]) ) {}
			target.length = j - 1;
		}
	};
}

function Sizzle( selector, context, results, seed ) {
	var m, i, elem, nid, match, groups, newSelector,
		newContext = context && context.ownerDocument,

		// nodeType defaults to 9, since context defaults to document
		nodeType = context ? context.nodeType : 9;

	results = results || [];

	// Return early from calls with invalid selector or context
	if ( typeof selector !== "string" || !selector ||
		nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {

		return results;
	}

	// Try to shortcut find operations (as opposed to filters) in HTML documents
	if ( !seed ) {

		if ( ( context ? context.ownerDocument || context : preferredDoc ) !== document ) {
			setDocument( context );
		}
		context = context || document;

		if ( documentIsHTML ) {

			// If the selector is sufficiently simple, try using a "get*By*" DOM method
			// (excepting DocumentFragment context, where the methods don't exist)
			if ( nodeType !== 11 && (match = rquickExpr.exec( selector )) ) {

				// ID selector
				if ( (m = match[1]) ) {

					// Document context
					if ( nodeType === 9 ) {
						if ( (elem = context.getElementById( m )) ) {

							// Support: IE, Opera, Webkit
							// TODO: identify versions
							// getElementById can match elements by name instead of ID
							if ( elem.id === m ) {
								results.push( elem );
								return results;
							}
						} else {
							return results;
						}

					// Element context
					} else {

						// Support: IE, Opera, Webkit
						// TODO: identify versions
						// getElementById can match elements by name instead of ID
						if ( newContext && (elem = newContext.getElementById( m )) &&
							contains( context, elem ) &&
							elem.id === m ) {

							results.push( elem );
							return results;
						}
					}

				// Type selector
				} else if ( match[2] ) {
					push.apply( results, context.getElementsByTagName( selector ) );
					return results;

				// Class selector
				} else if ( (m = match[3]) && support.getElementsByClassName &&
					context.getElementsByClassName ) {

					push.apply( results, context.getElementsByClassName( m ) );
					return results;
				}
			}

			// Take advantage of querySelectorAll
			if ( support.qsa &&
				!nonnativeSelectorCache[ selector + " " ] &&
				(!rbuggyQSA || !rbuggyQSA.test( selector )) &&

				// Support: IE 8 only
				// Exclude object elements
				(nodeType !== 1 || context.nodeName.toLowerCase() !== "object") ) {

				newSelector = selector;
				newContext = context;

				// qSA considers elements outside a scoping root when evaluating child or
				// descendant combinators, which is not what we want.
				// In such cases, we work around the behavior by prefixing every selector in the
				// list with an ID selector referencing the scope context.
				// Thanks to Andrew Dupont for this technique.
				if ( nodeType === 1 && rdescend.test( selector ) ) {

					// Capture the context ID, setting it first if necessary
					if ( (nid = context.getAttribute( "id" )) ) {
						nid = nid.replace( rcssescape, fcssescape );
					} else {
						context.setAttribute( "id", (nid = expando) );
					}

					// Prefix every selector in the list
					groups = tokenize( selector );
					i = groups.length;
					while ( i-- ) {
						groups[i] = "#" + nid + " " + toSelector( groups[i] );
					}
					newSelector = groups.join( "," );

					// Expand context for sibling selectors
					newContext = rsibling.test( selector ) && testContext( context.parentNode ) ||
						context;
				}

				try {
					push.apply( results,
						newContext.querySelectorAll( newSelector )
					);
					return results;
				} catch ( qsaError ) {
					nonnativeSelectorCache( selector, true );
				} finally {
					if ( nid === expando ) {
						context.removeAttribute( "id" );
					}
				}
			}
		}
	}

	// All others
	return select( selector.replace( rtrim, "$1" ), context, results, seed );
}

/**
 * Create key-value caches of limited size
 * @returns {function(string, object)} Returns the Object data after storing it on itself with
 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
 *	deleting the oldest entry
 */
function createCache() {
	var keys = [];

	function cache( key, value ) {
		// Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
		if ( keys.push( key + " " ) > Expr.cacheLength ) {
			// Only keep the most recent entries
			delete cache[ keys.shift() ];
		}
		return (cache[ key + " " ] = value);
	}
	return cache;
}

/**
 * Mark a function for special use by Sizzle
 * @param {Function} fn The function to mark
 */
function markFunction( fn ) {
	fn[ expando ] = true;
	return fn;
}

/**
 * Support testing using an element
 * @param {Function} fn Passed the created element and returns a boolean result
 */
function assert( fn ) {
	var el = document.createElement("fieldset");

	try {
		return !!fn( el );
	} catch (e) {
		return false;
	} finally {
		// Remove from its parent by default
		if ( el.parentNode ) {
			el.parentNode.removeChild( el );
		}
		// release memory in IE
		el = null;
	}
}

/**
 * Adds the same handler for all of the specified attrs
 * @param {String} attrs Pipe-separated list of attributes
 * @param {Function} handler The method that will be applied
 */
function addHandle( attrs, handler ) {
	var arr = attrs.split("|"),
		i = arr.length;

	while ( i-- ) {
		Expr.attrHandle[ arr[i] ] = handler;
	}
}

/**
 * Checks document order of two siblings
 * @param {Element} a
 * @param {Element} b
 * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
 */
function siblingCheck( a, b ) {
	var cur = b && a,
		diff = cur && a.nodeType === 1 && b.nodeType === 1 &&
			a.sourceIndex - b.sourceIndex;

	// Use IE sourceIndex if available on both nodes
	if ( diff ) {
		return diff;
	}

	// Check if b follows a
	if ( cur ) {
		while ( (cur = cur.nextSibling) ) {
			if ( cur === b ) {
				return -1;
			}
		}
	}

	return a ? 1 : -1;
}

/**
 * Returns a function to use in pseudos for input types
 * @param {String} type
 */
function createInputPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return name === "input" && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for buttons
 * @param {String} type
 */
function createButtonPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return (name === "input" || name === "button") && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for :enabled/:disabled
 * @param {Boolean} disabled true for :disabled; false for :enabled
 */
function createDisabledPseudo( disabled ) {

	// Known :disabled false positives: fieldset[disabled] > legend:nth-of-type(n+2) :can-disable
	return function( elem ) {

		// Only certain elements can match :enabled or :disabled
		// https://html.spec.whatwg.org/multipage/scripting.html#selector-enabled
		// https://html.spec.whatwg.org/multipage/scripting.html#selector-disabled
		if ( "form" in elem ) {

			// Check for inherited disabledness on relevant non-disabled elements:
			// * listed form-associated elements in a disabled fieldset
			//   https://html.spec.whatwg.org/multipage/forms.html#category-listed
			//   https://html.spec.whatwg.org/multipage/forms.html#concept-fe-disabled
			// * option elements in a disabled optgroup
			//   https://html.spec.whatwg.org/multipage/forms.html#concept-option-disabled
			// All such elements have a "form" property.
			if ( elem.parentNode && elem.disabled === false ) {

				// Option elements defer to a parent optgroup if present
				if ( "label" in elem ) {
					if ( "label" in elem.parentNode ) {
						return elem.parentNode.disabled === disabled;
					} else {
						return elem.disabled === disabled;
					}
				}

				// Support: IE 6 - 11
				// Use the isDisabled shortcut property to check for disabled fieldset ancestors
				return elem.isDisabled === disabled ||

					// Where there is no isDisabled, check manually
					/* jshint -W018 */
					elem.isDisabled !== !disabled &&
						inDisabledFieldset( elem ) === disabled;
			}

			return elem.disabled === disabled;

		// Try to winnow out elements that can't be disabled before trusting the disabled property.
		// Some victims get caught in our net (label, legend, menu, track), but it shouldn't
		// even exist on them, let alone have a boolean value.
		} else if ( "label" in elem ) {
			return elem.disabled === disabled;
		}

		// Remaining elements are neither :enabled nor :disabled
		return false;
	};
}

/**
 * Returns a function to use in pseudos for positionals
 * @param {Function} fn
 */
function createPositionalPseudo( fn ) {
	return markFunction(function( argument ) {
		argument = +argument;
		return markFunction(function( seed, matches ) {
			var j,
				matchIndexes = fn( [], seed.length, argument ),
				i = matchIndexes.length;

			// Match elements found at the specified indexes
			while ( i-- ) {
				if ( seed[ (j = matchIndexes[i]) ] ) {
					seed[j] = !(matches[j] = seed[j]);
				}
			}
		});
	});
}

/**
 * Checks a node for validity as a Sizzle context
 * @param {Element|Object=} context
 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
 */
function testContext( context ) {
	return context && typeof context.getElementsByTagName !== "undefined" && context;
}

// Expose support vars for convenience
support = Sizzle.support = {};

/**
 * Detects XML nodes
 * @param {Element|Object} elem An element or a document
 * @returns {Boolean} True iff elem is a non-HTML XML node
 */
isXML = Sizzle.isXML = function( elem ) {
	var namespace = elem.namespaceURI,
		docElem = (elem.ownerDocument || elem).documentElement;

	// Support: IE <=8
	// Assume HTML when documentElement doesn't yet exist, such as inside loading iframes
	// https://bugs.jquery.com/ticket/4833
	return !rhtml.test( namespace || docElem && docElem.nodeName || "HTML" );
};

/**
 * Sets document-related variables once based on the current document
 * @param {Element|Object} [doc] An element or document object to use to set the document
 * @returns {Object} Returns the current document
 */
setDocument = Sizzle.setDocument = function( node ) {
	var hasCompare, subWindow,
		doc = node ? node.ownerDocument || node : preferredDoc;

	// Return early if doc is invalid or already selected
	if ( doc === document || doc.nodeType !== 9 || !doc.documentElement ) {
		return document;
	}

	// Update global variables
	document = doc;
	docElem = document.documentElement;
	documentIsHTML = !isXML( document );

	// Support: IE 9-11, Edge
	// Accessing iframe documents after unload throws "permission denied" errors (jQuery #13936)
	if ( preferredDoc !== document &&
		(subWindow = document.defaultView) && subWindow.top !== subWindow ) {

		// Support: IE 11, Edge
		if ( subWindow.addEventListener ) {
			subWindow.addEventListener( "unload", unloadHandler, false );

		// Support: IE 9 - 10 only
		} else if ( subWindow.attachEvent ) {
			subWindow.attachEvent( "onunload", unloadHandler );
		}
	}

	/* Attributes
	---------------------------------------------------------------------- */

	// Support: IE<8
	// Verify that getAttribute really returns attributes and not properties
	// (excepting IE8 booleans)
	support.attributes = assert(function( el ) {
		el.className = "i";
		return !el.getAttribute("className");
	});

	/* getElement(s)By*
	---------------------------------------------------------------------- */

	// Check if getElementsByTagName("*") returns only elements
	support.getElementsByTagName = assert(function( el ) {
		el.appendChild( document.createComment("") );
		return !el.getElementsByTagName("*").length;
	});

	// Support: IE<9
	support.getElementsByClassName = rnative.test( document.getElementsByClassName );

	// Support: IE<10
	// Check if getElementById returns elements by name
	// The broken getElementById methods don't pick up programmatically-set names,
	// so use a roundabout getElementsByName test
	support.getById = assert(function( el ) {
		docElem.appendChild( el ).id = expando;
		return !document.getElementsByName || !document.getElementsByName( expando ).length;
	});

	// ID filter and find
	if ( support.getById ) {
		Expr.filter["ID"] = function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				return elem.getAttribute("id") === attrId;
			};
		};
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var elem = context.getElementById( id );
				return elem ? [ elem ] : [];
			}
		};
	} else {
		Expr.filter["ID"] =  function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				var node = typeof elem.getAttributeNode !== "undefined" &&
					elem.getAttributeNode("id");
				return node && node.value === attrId;
			};
		};

		// Support: IE 6 - 7 only
		// getElementById is not reliable as a find shortcut
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var node, i, elems,
					elem = context.getElementById( id );

				if ( elem ) {

					// Verify the id attribute
					node = elem.getAttributeNode("id");
					if ( node && node.value === id ) {
						return [ elem ];
					}

					// Fall back on getElementsByName
					elems = context.getElementsByName( id );
					i = 0;
					while ( (elem = elems[i++]) ) {
						node = elem.getAttributeNode("id");
						if ( node && node.value === id ) {
							return [ elem ];
						}
					}
				}

				return [];
			}
		};
	}

	// Tag
	Expr.find["TAG"] = support.getElementsByTagName ?
		function( tag, context ) {
			if ( typeof context.getElementsByTagName !== "undefined" ) {
				return context.getElementsByTagName( tag );

			// DocumentFragment nodes don't have gEBTN
			} else if ( support.qsa ) {
				return context.querySelectorAll( tag );
			}
		} :

		function( tag, context ) {
			var elem,
				tmp = [],
				i = 0,
				// By happy coincidence, a (broken) gEBTN appears on DocumentFragment nodes too
				results = context.getElementsByTagName( tag );

			// Filter out possible comments
			if ( tag === "*" ) {
				while ( (elem = results[i++]) ) {
					if ( elem.nodeType === 1 ) {
						tmp.push( elem );
					}
				}

				return tmp;
			}
			return results;
		};

	// Class
	Expr.find["CLASS"] = support.getElementsByClassName && function( className, context ) {
		if ( typeof context.getElementsByClassName !== "undefined" && documentIsHTML ) {
			return context.getElementsByClassName( className );
		}
	};

	/* QSA/matchesSelector
	---------------------------------------------------------------------- */

	// QSA and matchesSelector support

	// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
	rbuggyMatches = [];

	// qSa(:focus) reports false when true (Chrome 21)
	// We allow this because of a bug in IE8/9 that throws an error
	// whenever `document.activeElement` is accessed on an iframe
	// So, we allow :focus to pass through QSA all the time to avoid the IE error
	// See https://bugs.jquery.com/ticket/13378
	rbuggyQSA = [];

	if ( (support.qsa = rnative.test( document.querySelectorAll )) ) {
		// Build QSA regex
		// Regex strategy adopted from Diego Perini
		assert(function( el ) {
			// Select is set to empty string on purpose
			// This is to test IE's treatment of not explicitly
			// setting a boolean content attribute,
			// since its presence should be enough
			// https://bugs.jquery.com/ticket/12359
			docElem.appendChild( el ).innerHTML = "<a id='" + expando + "'></a>" +
				"<select id='" + expando + "-\r\\' msallowcapture=''>" +
				"<option selected=''></option></select>";

			// Support: IE8, Opera 11-12.16
			// Nothing should be selected when empty strings follow ^= or $= or *=
			// The test attribute must be unknown in Opera but "safe" for WinRT
			// https://msdn.microsoft.com/en-us/library/ie/hh465388.aspx#attribute_section
			if ( el.querySelectorAll("[msallowcapture^='']").length ) {
				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:''|\"\")" );
			}

			// Support: IE8
			// Boolean attributes and "value" are not treated correctly
			if ( !el.querySelectorAll("[selected]").length ) {
				rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
			}

			// Support: Chrome<29, Android<4.4, Safari<7.0+, iOS<7.0+, PhantomJS<1.9.8+
			if ( !el.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
				rbuggyQSA.push("~=");
			}

			// Webkit/Opera - :checked should return selected option elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			// IE8 throws error here and will not see later tests
			if ( !el.querySelectorAll(":checked").length ) {
				rbuggyQSA.push(":checked");
			}

			// Support: Safari 8+, iOS 8+
			// https://bugs.webkit.org/show_bug.cgi?id=136851
			// In-page `selector#id sibling-combinator selector` fails
			if ( !el.querySelectorAll( "a#" + expando + "+*" ).length ) {
				rbuggyQSA.push(".#.+[+~]");
			}
		});

		assert(function( el ) {
			el.innerHTML = "<a href='' disabled='disabled'></a>" +
				"<select disabled='disabled'><option/></select>";

			// Support: Windows 8 Native Apps
			// The type and name attributes are restricted during .innerHTML assignment
			var input = document.createElement("input");
			input.setAttribute( "type", "hidden" );
			el.appendChild( input ).setAttribute( "name", "D" );

			// Support: IE8
			// Enforce case-sensitivity of name attribute
			if ( el.querySelectorAll("[name=d]").length ) {
				rbuggyQSA.push( "name" + whitespace + "*[*^$|!~]?=" );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
			// IE8 throws error here and will not see later tests
			if ( el.querySelectorAll(":enabled").length !== 2 ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Support: IE9-11+
			// IE's :disabled selector does not pick up the children of disabled fieldsets
			docElem.appendChild( el ).disabled = true;
			if ( el.querySelectorAll(":disabled").length !== 2 ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Opera 10-11 does not throw on post-comma invalid pseudos
			el.querySelectorAll("*,:x");
			rbuggyQSA.push(",.*:");
		});
	}

	if ( (support.matchesSelector = rnative.test( (matches = docElem.matches ||
		docElem.webkitMatchesSelector ||
		docElem.mozMatchesSelector ||
		docElem.oMatchesSelector ||
		docElem.msMatchesSelector) )) ) {

		assert(function( el ) {
			// Check to see if it's possible to do matchesSelector
			// on a disconnected node (IE 9)
			support.disconnectedMatch = matches.call( el, "*" );

			// This should fail with an exception
			// Gecko does not error, returns false instead
			matches.call( el, "[s!='']:x" );
			rbuggyMatches.push( "!=", pseudos );
		});
	}

	rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join("|") );
	rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join("|") );

	/* Contains
	---------------------------------------------------------------------- */
	hasCompare = rnative.test( docElem.compareDocumentPosition );

	// Element contains another
	// Purposefully self-exclusive
	// As in, an element does not contain itself
	contains = hasCompare || rnative.test( docElem.contains ) ?
		function( a, b ) {
			var adown = a.nodeType === 9 ? a.documentElement : a,
				bup = b && b.parentNode;
			return a === bup || !!( bup && bup.nodeType === 1 && (
				adown.contains ?
					adown.contains( bup ) :
					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
			));
		} :
		function( a, b ) {
			if ( b ) {
				while ( (b = b.parentNode) ) {
					if ( b === a ) {
						return true;
					}
				}
			}
			return false;
		};

	/* Sorting
	---------------------------------------------------------------------- */

	// Document order sorting
	sortOrder = hasCompare ?
	function( a, b ) {

		// Flag for duplicate removal
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		// Sort on method existence if only one input has compareDocumentPosition
		var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
		if ( compare ) {
			return compare;
		}

		// Calculate position if both inputs belong to the same document
		compare = ( a.ownerDocument || a ) === ( b.ownerDocument || b ) ?
			a.compareDocumentPosition( b ) :

			// Otherwise we know they are disconnected
			1;

		// Disconnected nodes
		if ( compare & 1 ||
			(!support.sortDetached && b.compareDocumentPosition( a ) === compare) ) {

			// Choose the first element that is related to our preferred document
			if ( a === document || a.ownerDocument === preferredDoc && contains(preferredDoc, a) ) {
				return -1;
			}
			if ( b === document || b.ownerDocument === preferredDoc && contains(preferredDoc, b) ) {
				return 1;
			}

			// Maintain original order
			return sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;
		}

		return compare & 4 ? -1 : 1;
	} :
	function( a, b ) {
		// Exit early if the nodes are identical
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		var cur,
			i = 0,
			aup = a.parentNode,
			bup = b.parentNode,
			ap = [ a ],
			bp = [ b ];

		// Parentless nodes are either documents or disconnected
		if ( !aup || !bup ) {
			return a === document ? -1 :
				b === document ? 1 :
				aup ? -1 :
				bup ? 1 :
				sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;

		// If the nodes are siblings, we can do a quick check
		} else if ( aup === bup ) {
			return siblingCheck( a, b );
		}

		// Otherwise we need full lists of their ancestors for comparison
		cur = a;
		while ( (cur = cur.parentNode) ) {
			ap.unshift( cur );
		}
		cur = b;
		while ( (cur = cur.parentNode) ) {
			bp.unshift( cur );
		}

		// Walk down the tree looking for a discrepancy
		while ( ap[i] === bp[i] ) {
			i++;
		}

		return i ?
			// Do a sibling check if the nodes have a common ancestor
			siblingCheck( ap[i], bp[i] ) :

			// Otherwise nodes in our document sort first
			ap[i] === preferredDoc ? -1 :
			bp[i] === preferredDoc ? 1 :
			0;
	};

	return document;
};

Sizzle.matches = function( expr, elements ) {
	return Sizzle( expr, null, null, elements );
};

Sizzle.matchesSelector = function( elem, expr ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	if ( support.matchesSelector && documentIsHTML &&
		!nonnativeSelectorCache[ expr + " " ] &&
		( !rbuggyMatches || !rbuggyMatches.test( expr ) ) &&
		( !rbuggyQSA     || !rbuggyQSA.test( expr ) ) ) {

		try {
			var ret = matches.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( ret || support.disconnectedMatch ||
					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch (e) {
			nonnativeSelectorCache( expr, true );
		}
	}

	return Sizzle( expr, document, null, [ elem ] ).length > 0;
};

Sizzle.contains = function( context, elem ) {
	// Set document vars if needed
	if ( ( context.ownerDocument || context ) !== document ) {
		setDocument( context );
	}
	return contains( context, elem );
};

Sizzle.attr = function( elem, name ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	var fn = Expr.attrHandle[ name.toLowerCase() ],
		// Don't get fooled by Object.prototype properties (jQuery #13807)
		val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
			fn( elem, name, !documentIsHTML ) :
			undefined;

	return val !== undefined ?
		val :
		support.attributes || !documentIsHTML ?
			elem.getAttribute( name ) :
			(val = elem.getAttributeNode(name)) && val.specified ?
				val.value :
				null;
};

Sizzle.escape = function( sel ) {
	return (sel + "").replace( rcssescape, fcssescape );
};

Sizzle.error = function( msg ) {
	throw new Error( "Syntax error, unrecognized expression: " + msg );
};

/**
 * Document sorting and removing duplicates
 * @param {ArrayLike} results
 */
Sizzle.uniqueSort = function( results ) {
	var elem,
		duplicates = [],
		j = 0,
		i = 0;

	// Unless we *know* we can detect duplicates, assume their presence
	hasDuplicate = !support.detectDuplicates;
	sortInput = !support.sortStable && results.slice( 0 );
	results.sort( sortOrder );

	if ( hasDuplicate ) {
		while ( (elem = results[i++]) ) {
			if ( elem === results[ i ] ) {
				j = duplicates.push( i );
			}
		}
		while ( j-- ) {
			results.splice( duplicates[ j ], 1 );
		}
	}

	// Clear input after sorting to release objects
	// See https://github.com/jquery/sizzle/pull/225
	sortInput = null;

	return results;
};

/**
 * Utility function for retrieving the text value of an array of DOM nodes
 * @param {Array|Element} elem
 */
getText = Sizzle.getText = function( elem ) {
	var node,
		ret = "",
		i = 0,
		nodeType = elem.nodeType;

	if ( !nodeType ) {
		// If no nodeType, this is expected to be an array
		while ( (node = elem[i++]) ) {
			// Do not traverse comment nodes
			ret += getText( node );
		}
	} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
		// Use textContent for elements
		// innerText usage removed for consistency of new lines (jQuery #11153)
		if ( typeof elem.textContent === "string" ) {
			return elem.textContent;
		} else {
			// Traverse its children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				ret += getText( elem );
			}
		}
	} else if ( nodeType === 3 || nodeType === 4 ) {
		return elem.nodeValue;
	}
	// Do not include comment or processing instruction nodes

	return ret;
};

Expr = Sizzle.selectors = {

	// Can be adjusted by the user
	cacheLength: 50,

	createPseudo: markFunction,

	match: matchExpr,

	attrHandle: {},

	find: {},

	relative: {
		">": { dir: "parentNode", first: true },
		" ": { dir: "parentNode" },
		"+": { dir: "previousSibling", first: true },
		"~": { dir: "previousSibling" }
	},

	preFilter: {
		"ATTR": function( match ) {
			match[1] = match[1].replace( runescape, funescape );

			// Move the given value to match[3] whether quoted or unquoted
			match[3] = ( match[3] || match[4] || match[5] || "" ).replace( runescape, funescape );

			if ( match[2] === "~=" ) {
				match[3] = " " + match[3] + " ";
			}

			return match.slice( 0, 4 );
		},

		"CHILD": function( match ) {
			/* matches from matchExpr["CHILD"]
				1 type (only|nth|...)
				2 what (child|of-type)
				3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
				4 xn-component of xn+y argument ([+-]?\d*n|)
				5 sign of xn-component
				6 x of xn-component
				7 sign of y-component
				8 y of y-component
			*/
			match[1] = match[1].toLowerCase();

			if ( match[1].slice( 0, 3 ) === "nth" ) {
				// nth-* requires argument
				if ( !match[3] ) {
					Sizzle.error( match[0] );
				}

				// numeric x and y parameters for Expr.filter.CHILD
				// remember that false/true cast respectively to 0/1
				match[4] = +( match[4] ? match[5] + (match[6] || 1) : 2 * ( match[3] === "even" || match[3] === "odd" ) );
				match[5] = +( ( match[7] + match[8] ) || match[3] === "odd" );

			// other types prohibit arguments
			} else if ( match[3] ) {
				Sizzle.error( match[0] );
			}

			return match;
		},

		"PSEUDO": function( match ) {
			var excess,
				unquoted = !match[6] && match[2];

			if ( matchExpr["CHILD"].test( match[0] ) ) {
				return null;
			}

			// Accept quoted arguments as-is
			if ( match[3] ) {
				match[2] = match[4] || match[5] || "";

			// Strip excess characters from unquoted arguments
			} else if ( unquoted && rpseudo.test( unquoted ) &&
				// Get excess from tokenize (recursively)
				(excess = tokenize( unquoted, true )) &&
				// advance to the next closing parenthesis
				(excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {

				// excess is a negative index
				match[0] = match[0].slice( 0, excess );
				match[2] = unquoted.slice( 0, excess );
			}

			// Return only captures needed by the pseudo filter method (type and argument)
			return match.slice( 0, 3 );
		}
	},

	filter: {

		"TAG": function( nodeNameSelector ) {
			var nodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
			return nodeNameSelector === "*" ?
				function() { return true; } :
				function( elem ) {
					return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
				};
		},

		"CLASS": function( className ) {
			var pattern = classCache[ className + " " ];

			return pattern ||
				(pattern = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" )) &&
				classCache( className, function( elem ) {
					return pattern.test( typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== "undefined" && elem.getAttribute("class") || "" );
				});
		},

		"ATTR": function( name, operator, check ) {
			return function( elem ) {
				var result = Sizzle.attr( elem, name );

				if ( result == null ) {
					return operator === "!=";
				}
				if ( !operator ) {
					return true;
				}

				result += "";

				return operator === "=" ? result === check :
					operator === "!=" ? result !== check :
					operator === "^=" ? check && result.indexOf( check ) === 0 :
					operator === "*=" ? check && result.indexOf( check ) > -1 :
					operator === "$=" ? check && result.slice( -check.length ) === check :
					operator === "~=" ? ( " " + result.replace( rwhitespace, " " ) + " " ).indexOf( check ) > -1 :
					operator === "|=" ? result === check || result.slice( 0, check.length + 1 ) === check + "-" :
					false;
			};
		},

		"CHILD": function( type, what, argument, first, last ) {
			var simple = type.slice( 0, 3 ) !== "nth",
				forward = type.slice( -4 ) !== "last",
				ofType = what === "of-type";

			return first === 1 && last === 0 ?

				// Shortcut for :nth-*(n)
				function( elem ) {
					return !!elem.parentNode;
				} :

				function( elem, context, xml ) {
					var cache, uniqueCache, outerCache, node, nodeIndex, start,
						dir = simple !== forward ? "nextSibling" : "previousSibling",
						parent = elem.parentNode,
						name = ofType && elem.nodeName.toLowerCase(),
						useCache = !xml && !ofType,
						diff = false;

					if ( parent ) {

						// :(first|last|only)-(child|of-type)
						if ( simple ) {
							while ( dir ) {
								node = elem;
								while ( (node = node[ dir ]) ) {
									if ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) {

										return false;
									}
								}
								// Reverse direction for :only-* (if we haven't yet done so)
								start = dir = type === "only" && !start && "nextSibling";
							}
							return true;
						}

						start = [ forward ? parent.firstChild : parent.lastChild ];

						// non-xml :nth-child(...) stores cache data on `parent`
						if ( forward && useCache ) {

							// Seek `elem` from a previously-cached index

							// ...in a gzip-friendly way
							node = parent;
							outerCache = node[ expando ] || (node[ expando ] = {});

							// Support: IE <9 only
							// Defend against cloned attroperties (jQuery gh-1709)
							uniqueCache = outerCache[ node.uniqueID ] ||
								(outerCache[ node.uniqueID ] = {});

							cache = uniqueCache[ type ] || [];
							nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
							diff = nodeIndex && cache[ 2 ];
							node = nodeIndex && parent.childNodes[ nodeIndex ];

							while ( (node = ++nodeIndex && node && node[ dir ] ||

								// Fallback to seeking `elem` from the start
								(diff = nodeIndex = 0) || start.pop()) ) {

								// When found, cache indexes on `parent` and break
								if ( node.nodeType === 1 && ++diff && node === elem ) {
									uniqueCache[ type ] = [ dirruns, nodeIndex, diff ];
									break;
								}
							}

						} else {
							// Use previously-cached element index if available
							if ( useCache ) {
								// ...in a gzip-friendly way
								node = elem;
								outerCache = node[ expando ] || (node[ expando ] = {});

								// Support: IE <9 only
								// Defend against cloned attroperties (jQuery gh-1709)
								uniqueCache = outerCache[ node.uniqueID ] ||
									(outerCache[ node.uniqueID ] = {});

								cache = uniqueCache[ type ] || [];
								nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
								diff = nodeIndex;
							}

							// xml :nth-child(...)
							// or :nth-last-child(...) or :nth(-last)?-of-type(...)
							if ( diff === false ) {
								// Use the same loop as above to seek `elem` from the start
								while ( (node = ++nodeIndex && node && node[ dir ] ||
									(diff = nodeIndex = 0) || start.pop()) ) {

									if ( ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) &&
										++diff ) {

										// Cache the index of each encountered element
										if ( useCache ) {
											outerCache = node[ expando ] || (node[ expando ] = {});

											// Support: IE <9 only
											// Defend against cloned attroperties (jQuery gh-1709)
											uniqueCache = outerCache[ node.uniqueID ] ||
												(outerCache[ node.uniqueID ] = {});

											uniqueCache[ type ] = [ dirruns, diff ];
										}

										if ( node === elem ) {
											break;
										}
									}
								}
							}
						}

						// Incorporate the offset, then check against cycle size
						diff -= last;
						return diff === first || ( diff % first === 0 && diff / first >= 0 );
					}
				};
		},

		"PSEUDO": function( pseudo, argument ) {
			// pseudo-class names are case-insensitive
			// http://www.w3.org/TR/selectors/#pseudo-classes
			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
			// Remember that setFilters inherits from pseudos
			var args,
				fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
					Sizzle.error( "unsupported pseudo: " + pseudo );

			// The user may use createPseudo to indicate that
			// arguments are needed to create the filter function
			// just as Sizzle does
			if ( fn[ expando ] ) {
				return fn( argument );
			}

			// But maintain support for old signatures
			if ( fn.length > 1 ) {
				args = [ pseudo, pseudo, "", argument ];
				return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
					markFunction(function( seed, matches ) {
						var idx,
							matched = fn( seed, argument ),
							i = matched.length;
						while ( i-- ) {
							idx = indexOf( seed, matched[i] );
							seed[ idx ] = !( matches[ idx ] = matched[i] );
						}
					}) :
					function( elem ) {
						return fn( elem, 0, args );
					};
			}

			return fn;
		}
	},

	pseudos: {
		// Potentially complex pseudos
		"not": markFunction(function( selector ) {
			// Trim the selector passed to compile
			// to avoid treating leading and trailing
			// spaces as combinators
			var input = [],
				results = [],
				matcher = compile( selector.replace( rtrim, "$1" ) );

			return matcher[ expando ] ?
				markFunction(function( seed, matches, context, xml ) {
					var elem,
						unmatched = matcher( seed, null, xml, [] ),
						i = seed.length;

					// Match elements unmatched by `matcher`
					while ( i-- ) {
						if ( (elem = unmatched[i]) ) {
							seed[i] = !(matches[i] = elem);
						}
					}
				}) :
				function( elem, context, xml ) {
					input[0] = elem;
					matcher( input, null, xml, results );
					// Don't keep the element (issue #299)
					input[0] = null;
					return !results.pop();
				};
		}),

		"has": markFunction(function( selector ) {
			return function( elem ) {
				return Sizzle( selector, elem ).length > 0;
			};
		}),

		"contains": markFunction(function( text ) {
			text = text.replace( runescape, funescape );
			return function( elem ) {
				return ( elem.textContent || getText( elem ) ).indexOf( text ) > -1;
			};
		}),

		// "Whether an element is represented by a :lang() selector
		// is based solely on the element's language value
		// being equal to the identifier C,
		// or beginning with the identifier C immediately followed by "-".
		// The matching of C against the element's language value is performed case-insensitively.
		// The identifier C does not have to be a valid language name."
		// http://www.w3.org/TR/selectors/#lang-pseudo
		"lang": markFunction( function( lang ) {
			// lang value must be a valid identifier
			if ( !ridentifier.test(lang || "") ) {
				Sizzle.error( "unsupported lang: " + lang );
			}
			lang = lang.replace( runescape, funescape ).toLowerCase();
			return function( elem ) {
				var elemLang;
				do {
					if ( (elemLang = documentIsHTML ?
						elem.lang :
						elem.getAttribute("xml:lang") || elem.getAttribute("lang")) ) {

						elemLang = elemLang.toLowerCase();
						return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
					}
				} while ( (elem = elem.parentNode) && elem.nodeType === 1 );
				return false;
			};
		}),

		// Miscellaneous
		"target": function( elem ) {
			var hash = window.location && window.location.hash;
			return hash && hash.slice( 1 ) === elem.id;
		},

		"root": function( elem ) {
			return elem === docElem;
		},

		"focus": function( elem ) {
			return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
		},

		// Boolean properties
		"enabled": createDisabledPseudo( false ),
		"disabled": createDisabledPseudo( true ),

		"checked": function( elem ) {
			// In CSS3, :checked should return both checked and selected elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			var nodeName = elem.nodeName.toLowerCase();
			return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
		},

		"selected": function( elem ) {
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}

			return elem.selected === true;
		},

		// Contents
		"empty": function( elem ) {
			// http://www.w3.org/TR/selectors/#empty-pseudo
			// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
			//   but not by others (comment: 8; processing instruction: 7; etc.)
			// nodeType < 6 works because attributes (2) do not appear as children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				if ( elem.nodeType < 6 ) {
					return false;
				}
			}
			return true;
		},

		"parent": function( elem ) {
			return !Expr.pseudos["empty"]( elem );
		},

		// Element/input types
		"header": function( elem ) {
			return rheader.test( elem.nodeName );
		},

		"input": function( elem ) {
			return rinputs.test( elem.nodeName );
		},

		"button": function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && elem.type === "button" || name === "button";
		},

		"text": function( elem ) {
			var attr;
			return elem.nodeName.toLowerCase() === "input" &&
				elem.type === "text" &&

				// Support: IE<8
				// New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
				( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text" );
		},

		// Position-in-collection
		"first": createPositionalPseudo(function() {
			return [ 0 ];
		}),

		"last": createPositionalPseudo(function( matchIndexes, length ) {
			return [ length - 1 ];
		}),

		"eq": createPositionalPseudo(function( matchIndexes, length, argument ) {
			return [ argument < 0 ? argument + length : argument ];
		}),

		"even": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 0;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"odd": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 1;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"lt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ?
				argument + length :
				argument > length ?
					length :
					argument;
			for ( ; --i >= 0; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"gt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; ++i < length; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		})
	}
};

Expr.pseudos["nth"] = Expr.pseudos["eq"];

// Add button/input type pseudos
for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
	Expr.pseudos[ i ] = createInputPseudo( i );
}
for ( i in { submit: true, reset: true } ) {
	Expr.pseudos[ i ] = createButtonPseudo( i );
}

// Easy API for creating new setFilters
function setFilters() {}
setFilters.prototype = Expr.filters = Expr.pseudos;
Expr.setFilters = new setFilters();

tokenize = Sizzle.tokenize = function( selector, parseOnly ) {
	var matched, match, tokens, type,
		soFar, groups, preFilters,
		cached = tokenCache[ selector + " " ];

	if ( cached ) {
		return parseOnly ? 0 : cached.slice( 0 );
	}

	soFar = selector;
	groups = [];
	preFilters = Expr.preFilter;

	while ( soFar ) {

		// Comma and first run
		if ( !matched || (match = rcomma.exec( soFar )) ) {
			if ( match ) {
				// Don't consume trailing commas as valid
				soFar = soFar.slice( match[0].length ) || soFar;
			}
			groups.push( (tokens = []) );
		}

		matched = false;

		// Combinators
		if ( (match = rcombinators.exec( soFar )) ) {
			matched = match.shift();
			tokens.push({
				value: matched,
				// Cast descendant combinators to space
				type: match[0].replace( rtrim, " " )
			});
			soFar = soFar.slice( matched.length );
		}

		// Filters
		for ( type in Expr.filter ) {
			if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
				(match = preFilters[ type ]( match ))) ) {
				matched = match.shift();
				tokens.push({
					value: matched,
					type: type,
					matches: match
				});
				soFar = soFar.slice( matched.length );
			}
		}

		if ( !matched ) {
			break;
		}
	}

	// Return the length of the invalid excess
	// if we're just parsing
	// Otherwise, throw an error or return tokens
	return parseOnly ?
		soFar.length :
		soFar ?
			Sizzle.error( selector ) :
			// Cache the tokens
			tokenCache( selector, groups ).slice( 0 );
};

function toSelector( tokens ) {
	var i = 0,
		len = tokens.length,
		selector = "";
	for ( ; i < len; i++ ) {
		selector += tokens[i].value;
	}
	return selector;
}

function addCombinator( matcher, combinator, base ) {
	var dir = combinator.dir,
		skip = combinator.next,
		key = skip || dir,
		checkNonElements = base && key === "parentNode",
		doneName = done++;

	return combinator.first ?
		// Check against closest ancestor/preceding element
		function( elem, context, xml ) {
			while ( (elem = elem[ dir ]) ) {
				if ( elem.nodeType === 1 || checkNonElements ) {
					return matcher( elem, context, xml );
				}
			}
			return false;
		} :

		// Check against all ancestor/preceding elements
		function( elem, context, xml ) {
			var oldCache, uniqueCache, outerCache,
				newCache = [ dirruns, doneName ];

			// We can't set arbitrary data on XML nodes, so they don't benefit from combinator caching
			if ( xml ) {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						if ( matcher( elem, context, xml ) ) {
							return true;
						}
					}
				}
			} else {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						outerCache = elem[ expando ] || (elem[ expando ] = {});

						// Support: IE <9 only
						// Defend against cloned attroperties (jQuery gh-1709)
						uniqueCache = outerCache[ elem.uniqueID ] || (outerCache[ elem.uniqueID ] = {});

						if ( skip && skip === elem.nodeName.toLowerCase() ) {
							elem = elem[ dir ] || elem;
						} else if ( (oldCache = uniqueCache[ key ]) &&
							oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

							// Assign to newCache so results back-propagate to previous elements
							return (newCache[ 2 ] = oldCache[ 2 ]);
						} else {
							// Reuse newcache so results back-propagate to previous elements
							uniqueCache[ key ] = newCache;

							// A match means we're done; a fail means we have to keep checking
							if ( (newCache[ 2 ] = matcher( elem, context, xml )) ) {
								return true;
							}
						}
					}
				}
			}
			return false;
		};
}

function elementMatcher( matchers ) {
	return matchers.length > 1 ?
		function( elem, context, xml ) {
			var i = matchers.length;
			while ( i-- ) {
				if ( !matchers[i]( elem, context, xml ) ) {
					return false;
				}
			}
			return true;
		} :
		matchers[0];
}

function multipleContexts( selector, contexts, results ) {
	var i = 0,
		len = contexts.length;
	for ( ; i < len; i++ ) {
		Sizzle( selector, contexts[i], results );
	}
	return results;
}

function condense( unmatched, map, filter, context, xml ) {
	var elem,
		newUnmatched = [],
		i = 0,
		len = unmatched.length,
		mapped = map != null;

	for ( ; i < len; i++ ) {
		if ( (elem = unmatched[i]) ) {
			if ( !filter || filter( elem, context, xml ) ) {
				newUnmatched.push( elem );
				if ( mapped ) {
					map.push( i );
				}
			}
		}
	}

	return newUnmatched;
}

function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
	if ( postFilter && !postFilter[ expando ] ) {
		postFilter = setMatcher( postFilter );
	}
	if ( postFinder && !postFinder[ expando ] ) {
		postFinder = setMatcher( postFinder, postSelector );
	}
	return markFunction(function( seed, results, context, xml ) {
		var temp, i, elem,
			preMap = [],
			postMap = [],
			preexisting = results.length,

			// Get initial elements from seed or context
			elems = seed || multipleContexts( selector || "*", context.nodeType ? [ context ] : context, [] ),

			// Prefilter to get matcher input, preserving a map for seed-results synchronization
			matcherIn = preFilter && ( seed || !selector ) ?
				condense( elems, preMap, preFilter, context, xml ) :
				elems,

			matcherOut = matcher ?
				// If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
				postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

					// ...intermediate processing is necessary
					[] :

					// ...otherwise use results directly
					results :
				matcherIn;

		// Find primary matches
		if ( matcher ) {
			matcher( matcherIn, matcherOut, context, xml );
		}

		// Apply postFilter
		if ( postFilter ) {
			temp = condense( matcherOut, postMap );
			postFilter( temp, [], context, xml );

			// Un-match failing elements by moving them back to matcherIn
			i = temp.length;
			while ( i-- ) {
				if ( (elem = temp[i]) ) {
					matcherOut[ postMap[i] ] = !(matcherIn[ postMap[i] ] = elem);
				}
			}
		}

		if ( seed ) {
			if ( postFinder || preFilter ) {
				if ( postFinder ) {
					// Get the final matcherOut by condensing this intermediate into postFinder contexts
					temp = [];
					i = matcherOut.length;
					while ( i-- ) {
						if ( (elem = matcherOut[i]) ) {
							// Restore matcherIn since elem is not yet a final match
							temp.push( (matcherIn[i] = elem) );
						}
					}
					postFinder( null, (matcherOut = []), temp, xml );
				}

				// Move matched elements from seed to results to keep them synchronized
				i = matcherOut.length;
				while ( i-- ) {
					if ( (elem = matcherOut[i]) &&
						(temp = postFinder ? indexOf( seed, elem ) : preMap[i]) > -1 ) {

						seed[temp] = !(results[temp] = elem);
					}
				}
			}

		// Add elements to results, through postFinder if defined
		} else {
			matcherOut = condense(
				matcherOut === results ?
					matcherOut.splice( preexisting, matcherOut.length ) :
					matcherOut
			);
			if ( postFinder ) {
				postFinder( null, results, matcherOut, xml );
			} else {
				push.apply( results, matcherOut );
			}
		}
	});
}

function matcherFromTokens( tokens ) {
	var checkContext, matcher, j,
		len = tokens.length,
		leadingRelative = Expr.relative[ tokens[0].type ],
		implicitRelative = leadingRelative || Expr.relative[" "],
		i = leadingRelative ? 1 : 0,

		// The foundational matcher ensures that elements are reachable from top-level context(s)
		matchContext = addCombinator( function( elem ) {
			return elem === checkContext;
		}, implicitRelative, true ),
		matchAnyContext = addCombinator( function( elem ) {
			return indexOf( checkContext, elem ) > -1;
		}, implicitRelative, true ),
		matchers = [ function( elem, context, xml ) {
			var ret = ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
				(checkContext = context).nodeType ?
					matchContext( elem, context, xml ) :
					matchAnyContext( elem, context, xml ) );
			// Avoid hanging onto element (issue #299)
			checkContext = null;
			return ret;
		} ];

	for ( ; i < len; i++ ) {
		if ( (matcher = Expr.relative[ tokens[i].type ]) ) {
			matchers = [ addCombinator(elementMatcher( matchers ), matcher) ];
		} else {
			matcher = Expr.filter[ tokens[i].type ].apply( null, tokens[i].matches );

			// Return special upon seeing a positional matcher
			if ( matcher[ expando ] ) {
				// Find the next relative operator (if any) for proper handling
				j = ++i;
				for ( ; j < len; j++ ) {
					if ( Expr.relative[ tokens[j].type ] ) {
						break;
					}
				}
				return setMatcher(
					i > 1 && elementMatcher( matchers ),
					i > 1 && toSelector(
						// If the preceding token was a descendant combinator, insert an implicit any-element `*`
						tokens.slice( 0, i - 1 ).concat({ value: tokens[ i - 2 ].type === " " ? "*" : "" })
					).replace( rtrim, "$1" ),
					matcher,
					i < j && matcherFromTokens( tokens.slice( i, j ) ),
					j < len && matcherFromTokens( (tokens = tokens.slice( j )) ),
					j < len && toSelector( tokens )
				);
			}
			matchers.push( matcher );
		}
	}

	return elementMatcher( matchers );
}

function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
	var bySet = setMatchers.length > 0,
		byElement = elementMatchers.length > 0,
		superMatcher = function( seed, context, xml, results, outermost ) {
			var elem, j, matcher,
				matchedCount = 0,
				i = "0",
				unmatched = seed && [],
				setMatched = [],
				contextBackup = outermostContext,
				// We must always have either seed elements or outermost context
				elems = seed || byElement && Expr.find["TAG"]( "*", outermost ),
				// Use integer dirruns iff this is the outermost matcher
				dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1),
				len = elems.length;

			if ( outermost ) {
				outermostContext = context === document || context || outermost;
			}

			// Add elements passing elementMatchers directly to results
			// Support: IE<9, Safari
			// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
			for ( ; i !== len && (elem = elems[i]) != null; i++ ) {
				if ( byElement && elem ) {
					j = 0;
					if ( !context && elem.ownerDocument !== document ) {
						setDocument( elem );
						xml = !documentIsHTML;
					}
					while ( (matcher = elementMatchers[j++]) ) {
						if ( matcher( elem, context || document, xml) ) {
							results.push( elem );
							break;
						}
					}
					if ( outermost ) {
						dirruns = dirrunsUnique;
					}
				}

				// Track unmatched elements for set filters
				if ( bySet ) {
					// They will have gone through all possible matchers
					if ( (elem = !matcher && elem) ) {
						matchedCount--;
					}

					// Lengthen the array for every element, matched or not
					if ( seed ) {
						unmatched.push( elem );
					}
				}
			}

			// `i` is now the count of elements visited above, and adding it to `matchedCount`
			// makes the latter nonnegative.
			matchedCount += i;

			// Apply set filters to unmatched elements
			// NOTE: This can be skipped if there are no unmatched elements (i.e., `matchedCount`
			// equals `i`), unless we didn't visit _any_ elements in the above loop because we have
			// no element matchers and no seed.
			// Incrementing an initially-string "0" `i` allows `i` to remain a string only in that
			// case, which will result in a "00" `matchedCount` that differs from `i` but is also
			// numerically zero.
			if ( bySet && i !== matchedCount ) {
				j = 0;
				while ( (matcher = setMatchers[j++]) ) {
					matcher( unmatched, setMatched, context, xml );
				}

				if ( seed ) {
					// Reintegrate element matches to eliminate the need for sorting
					if ( matchedCount > 0 ) {
						while ( i-- ) {
							if ( !(unmatched[i] || setMatched[i]) ) {
								setMatched[i] = pop.call( results );
							}
						}
					}

					// Discard index placeholder values to get only actual matches
					setMatched = condense( setMatched );
				}

				// Add matches to results
				push.apply( results, setMatched );

				// Seedless set matches succeeding multiple successful matchers stipulate sorting
				if ( outermost && !seed && setMatched.length > 0 &&
					( matchedCount + setMatchers.length ) > 1 ) {

					Sizzle.uniqueSort( results );
				}
			}

			// Override manipulation of globals by nested matchers
			if ( outermost ) {
				dirruns = dirrunsUnique;
				outermostContext = contextBackup;
			}

			return unmatched;
		};

	return bySet ?
		markFunction( superMatcher ) :
		superMatcher;
}

compile = Sizzle.compile = function( selector, match /* Internal Use Only */ ) {
	var i,
		setMatchers = [],
		elementMatchers = [],
		cached = compilerCache[ selector + " " ];

	if ( !cached ) {
		// Generate a function of recursive functions that can be used to check each element
		if ( !match ) {
			match = tokenize( selector );
		}
		i = match.length;
		while ( i-- ) {
			cached = matcherFromTokens( match[i] );
			if ( cached[ expando ] ) {
				setMatchers.push( cached );
			} else {
				elementMatchers.push( cached );
			}
		}

		// Cache the compiled function
		cached = compilerCache( selector, matcherFromGroupMatchers( elementMatchers, setMatchers ) );

		// Save selector and tokenization
		cached.selector = selector;
	}
	return cached;
};

/**
 * A low-level selection function that works with Sizzle's compiled
 *  selector functions
 * @param {String|Function} selector A selector or a pre-compiled
 *  selector function built with Sizzle.compile
 * @param {Element} context
 * @param {Array} [results]
 * @param {Array} [seed] A set of elements to match against
 */
select = Sizzle.select = function( selector, context, results, seed ) {
	var i, tokens, token, type, find,
		compiled = typeof selector === "function" && selector,
		match = !seed && tokenize( (selector = compiled.selector || selector) );

	results = results || [];

	// Try to minimize operations if there is only one selector in the list and no seed
	// (the latter of which guarantees us context)
	if ( match.length === 1 ) {

		// Reduce context if the leading compound selector is an ID
		tokens = match[0] = match[0].slice( 0 );
		if ( tokens.length > 2 && (token = tokens[0]).type === "ID" &&
				context.nodeType === 9 && documentIsHTML && Expr.relative[ tokens[1].type ] ) {

			context = ( Expr.find["ID"]( token.matches[0].replace(runescape, funescape), context ) || [] )[0];
			if ( !context ) {
				return results;

			// Precompiled matchers will still verify ancestry, so step up a level
			} else if ( compiled ) {
				context = context.parentNode;
			}

			selector = selector.slice( tokens.shift().value.length );
		}

		// Fetch a seed set for right-to-left matching
		i = matchExpr["needsContext"].test( selector ) ? 0 : tokens.length;
		while ( i-- ) {
			token = tokens[i];

			// Abort if we hit a combinator
			if ( Expr.relative[ (type = token.type) ] ) {
				break;
			}
			if ( (find = Expr.find[ type ]) ) {
				// Search, expanding context for leading sibling combinators
				if ( (seed = find(
					token.matches[0].replace( runescape, funescape ),
					rsibling.test( tokens[0].type ) && testContext( context.parentNode ) || context
				)) ) {

					// If seed is empty or no tokens remain, we can return early
					tokens.splice( i, 1 );
					selector = seed.length && toSelector( tokens );
					if ( !selector ) {
						push.apply( results, seed );
						return results;
					}

					break;
				}
			}
		}
	}

	// Compile and execute a filtering function if one is not provided
	// Provide `match` to avoid retokenization if we modified the selector above
	( compiled || compile( selector, match ) )(
		seed,
		context,
		!documentIsHTML,
		results,
		!context || rsibling.test( selector ) && testContext( context.parentNode ) || context
	);
	return results;
};

// One-time assignments

// Sort stability
support.sortStable = expando.split("").sort( sortOrder ).join("") === expando;

// Support: Chrome 14-35+
// Always assume duplicates if they aren't passed to the comparison function
support.detectDuplicates = !!hasDuplicate;

// Initialize against the default document
setDocument();

// Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
// Detached nodes confoundingly follow *each other*
support.sortDetached = assert(function( el ) {
	// Should return 1, but returns 4 (following)
	return el.compareDocumentPosition( document.createElement("fieldset") ) & 1;
});

// Support: IE<8
// Prevent attribute/property "interpolation"
// https://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
if ( !assert(function( el ) {
	el.innerHTML = "<a href='#'></a>";
	return el.firstChild.getAttribute("href") === "#" ;
}) ) {
	addHandle( "type|href|height|width", function( elem, name, isXML ) {
		if ( !isXML ) {
			return elem.getAttribute( name, name.toLowerCase() === "type" ? 1 : 2 );
		}
	});
}

// Support: IE<9
// Use defaultValue in place of getAttribute("value")
if ( !support.attributes || !assert(function( el ) {
	el.innerHTML = "<input/>";
	el.firstChild.setAttribute( "value", "" );
	return el.firstChild.getAttribute( "value" ) === "";
}) ) {
	addHandle( "value", function( elem, name, isXML ) {
		if ( !isXML && elem.nodeName.toLowerCase() === "input" ) {
			return elem.defaultValue;
		}
	});
}

// Support: IE<9
// Use getAttributeNode to fetch booleans when getAttribute lies
if ( !assert(function( el ) {
	return el.getAttribute("disabled") == null;
}) ) {
	addHandle( booleans, function( elem, name, isXML ) {
		var val;
		if ( !isXML ) {
			return elem[ name ] === true ? name.toLowerCase() :
					(val = elem.getAttributeNode( name )) && val.specified ?
					val.value :
				null;
		}
	});
}

return Sizzle;

})( window );



jQuery.find = Sizzle;
jQuery.expr = Sizzle.selectors;

// Deprecated
jQuery.expr[ ":" ] = jQuery.expr.pseudos;
jQuery.uniqueSort = jQuery.unique = Sizzle.uniqueSort;
jQuery.text = Sizzle.getText;
jQuery.isXMLDoc = Sizzle.isXML;
jQuery.contains = Sizzle.contains;
jQuery.escapeSelector = Sizzle.escape;




var dir = function( elem, dir, until ) {
	var matched = [],
		truncate = until !== undefined;

	while ( ( elem = elem[ dir ] ) && elem.nodeType !== 9 ) {
		if ( elem.nodeType === 1 ) {
			if ( truncate && jQuery( elem ).is( until ) ) {
				break;
			}
			matched.push( elem );
		}
	}
	return matched;
};


var siblings = function( n, elem ) {
	var matched = [];

	for ( ; n; n = n.nextSibling ) {
		if ( n.nodeType === 1 && n !== elem ) {
			matched.push( n );
		}
	}

	return matched;
};


var rneedsContext = jQuery.expr.match.needsContext;



function nodeName( elem, name ) {

  return elem.nodeName && elem.nodeName.toLowerCase() === name.toLowerCase();

};
var rsingleTag = ( /^<([a-z][^\/\0>:\x20\t\r\n\f]*)[\x20\t\r\n\f]*\/?>(?:<\/\1>|)$/i );



// Implement the identical functionality for filter and not
function winnow( elements, qualifier, not ) {
	if ( isFunction( qualifier ) ) {
		return jQuery.grep( elements, function( elem, i ) {
			return !!qualifier.call( elem, i, elem ) !== not;
		} );
	}

	// Single element
	if ( qualifier.nodeType ) {
		return jQuery.grep( elements, function( elem ) {
			return ( elem === qualifier ) !== not;
		} );
	}

	// Arraylike of elements (jQuery, arguments, Array)
	if ( typeof qualifier !== "string" ) {
		return jQuery.grep( elements, function( elem ) {
			return ( indexOf.call( qualifier, elem ) > -1 ) !== not;
		} );
	}

	// Filtered directly for both simple and complex selectors
	return jQuery.filter( qualifier, elements, not );
}

jQuery.filter = function( expr, elems, not ) {
	var elem = elems[ 0 ];

	if ( not ) {
		expr = ":not(" + expr + ")";
	}

	if ( elems.length === 1 && elem.nodeType === 1 ) {
		return jQuery.find.matchesSelector( elem, expr ) ? [ elem ] : [];
	}

	return jQuery.find.matches( expr, jQuery.grep( elems, function( elem ) {
		return elem.nodeType === 1;
	} ) );
};

jQuery.fn.extend( {
	find: function( selector ) {
		var i, ret,
			len = this.length,
			self = this;

		if ( typeof selector !== "string" ) {
			return this.pushStack( jQuery( selector ).filter( function() {
				for ( i = 0; i < len; i++ ) {
					if ( jQuery.contains( self[ i ], this ) ) {
						return true;
					}
				}
			} ) );
		}

		ret = this.pushStack( [] );

		for ( i = 0; i < len; i++ ) {
			jQuery.find( selector, self[ i ], ret );
		}

		return len > 1 ? jQuery.uniqueSort( ret ) : ret;
	},
	filter: function( selector ) {
		return this.pushStack( winnow( this, selector || [], false ) );
	},
	not: function( selector ) {
		return this.pushStack( winnow( this, selector || [], true ) );
	},
	is: function( selector ) {
		return !!winnow(
			this,

			// If this is a positional/relative selector, check membership in the returned set
			// so $("p:first").is("p:last") won't return true for a doc with two "p".
			typeof selector === "string" && rneedsContext.test( selector ) ?
				jQuery( selector ) :
				selector || [],
			false
		).length;
	}
} );


// Initialize a jQuery object


// A central reference to the root jQuery(document)
var rootjQuery,

	// A simple way to check for HTML strings
	// Prioritize #id over <tag> to avoid XSS via location.hash (#9521)
	// Strict HTML recognition (#11290: must start with <)
	// Shortcut simple #id case for speed
	rquickExpr = /^(?:\s*(<[\w\W]+>)[^>]*|#([\w-]+))$/,

	init = jQuery.fn.init = function( selector, context, root ) {
		var match, elem;

		// HANDLE: $(""), $(null), $(undefined), $(false)
		if ( !selector ) {
			return this;
		}

		// Method init() accepts an alternate rootjQuery
		// so migrate can support jQuery.sub (gh-2101)
		root = root || rootjQuery;

		// Handle HTML strings
		if ( typeof selector === "string" ) {
			if ( selector[ 0 ] === "<" &&
				selector[ selector.length - 1 ] === ">" &&
				selector.length >= 3 ) {

				// Assume that strings that start and end with <> are HTML and skip the regex check
				match = [ null, selector, null ];

			} else {
				match = rquickExpr.exec( selector );
			}

			// Match html or make sure no context is specified for #id
			if ( match && ( match[ 1 ] || !context ) ) {

				// HANDLE: $(html) -> $(array)
				if ( match[ 1 ] ) {
					context = context instanceof jQuery ? context[ 0 ] : context;

					// Option to run scripts is true for back-compat
					// Intentionally let the error be thrown if parseHTML is not present
					jQuery.merge( this, jQuery.parseHTML(
						match[ 1 ],
						context && context.nodeType ? context.ownerDocument || context : document,
						true
					) );

					// HANDLE: $(html, props)
					if ( rsingleTag.test( match[ 1 ] ) && jQuery.isPlainObject( context ) ) {
						for ( match in context ) {

							// Properties of context are called as methods if possible
							if ( isFunction( this[ match ] ) ) {
								this[ match ]( context[ match ] );

							// ...and otherwise set as attributes
							} else {
								this.attr( match, context[ match ] );
							}
						}
					}

					return this;

				// HANDLE: $(#id)
				} else {
					elem = document.getElementById( match[ 2 ] );

					if ( elem ) {

						// Inject the element directly into the jQuery object
						this[ 0 ] = elem;
						this.length = 1;
					}
					return this;
				}

			// HANDLE: $(expr, $(...))
			} else if ( !context || context.jquery ) {
				return ( context || root ).find( selector );

			// HANDLE: $(expr, context)
			// (which is just equivalent to: $(context).find(expr)
			} else {
				return this.constructor( context ).find( selector );
			}

		// HANDLE: $(DOMElement)
		} else if ( selector.nodeType ) {
			this[ 0 ] = selector;
			this.length = 1;
			return this;

		// HANDLE: $(function)
		// Shortcut for document ready
		} else if ( isFunction( selector ) ) {
			return root.ready !== undefined ?
				root.ready( selector ) :

				// Execute immediately if ready is not present
				selector( jQuery );
		}

		return jQuery.makeArray( selector, this );
	};

// Give the init function the jQuery prototype for later instantiation
init.prototype = jQuery.fn;

// Initialize central reference
rootjQuery = jQuery( document );


var rparentsprev = /^(?:parents|prev(?:Until|All))/,

	// Methods guaranteed to produce a unique set when starting from a unique set
	guaranteedUnique = {
		children: true,
		contents: true,
		next: true,
		prev: true
	};

jQuery.fn.extend( {
	has: function( target ) {
		var targets = jQuery( target, this ),
			l = targets.length;

		return this.filter( function() {
			var i = 0;
			for ( ; i < l; i++ ) {
				if ( jQuery.contains( this, targets[ i ] ) ) {
					return true;
				}
			}
		} );
	},

	closest: function( selectors, context ) {
		var cur,
			i = 0,
			l = this.length,
			matched = [],
			targets = typeof selectors !== "string" && jQuery( selectors );

		// Positional selectors never match, since there's no _selection_ context
		if ( !rneedsContext.test( selectors ) ) {
			for ( ; i < l; i++ ) {
				for ( cur = this[ i ]; cur && cur !== context; cur = cur.parentNode ) {

					// Always skip document fragments
					if ( cur.nodeType < 11 && ( targets ?
						targets.index( cur ) > -1 :

						// Don't pass non-elements to Sizzle
						cur.nodeType === 1 &&
							jQuery.find.matchesSelector( cur, selectors ) ) ) {

						matched.push( cur );
						break;
					}
				}
			}
		}

		return this.pushStack( matched.length > 1 ? jQuery.uniqueSort( matched ) : matched );
	},

	// Determine the position of an element within the set
	index: function( elem ) {

		// No argument, return index in parent
		if ( !elem ) {
			return ( this[ 0 ] && this[ 0 ].parentNode ) ? this.first().prevAll().length : -1;
		}

		// Index in selector
		if ( typeof elem === "string" ) {
			return indexOf.call( jQuery( elem ), this[ 0 ] );
		}

		// Locate the position of the desired element
		return indexOf.call( this,

			// If it receives a jQuery object, the first element is used
			elem.jquery ? elem[ 0 ] : elem
		);
	},

	add: function( selector, context ) {
		return this.pushStack(
			jQuery.uniqueSort(
				jQuery.merge( this.get(), jQuery( selector, context ) )
			)
		);
	},

	addBack: function( selector ) {
		return this.add( selector == null ?
			this.prevObject : this.prevObject.filter( selector )
		);
	}
} );

function sibling( cur, dir ) {
	while ( ( cur = cur[ dir ] ) && cur.nodeType !== 1 ) {}
	return cur;
}

jQuery.each( {
	parent: function( elem ) {
		var parent = elem.parentNode;
		return parent && parent.nodeType !== 11 ? parent : null;
	},
	parents: function( elem ) {
		return dir( elem, "parentNode" );
	},
	parentsUntil: function( elem, i, until ) {
		return dir( elem, "parentNode", until );
	},
	next: function( elem ) {
		return sibling( elem, "nextSibling" );
	},
	prev: function( elem ) {
		return sibling( elem, "previousSibling" );
	},
	nextAll: function( elem ) {
		return dir( elem, "nextSibling" );
	},
	prevAll: function( elem ) {
		return dir( elem, "previousSibling" );
	},
	nextUntil: function( elem, i, until ) {
		return dir( elem, "nextSibling", until );
	},
	prevUntil: function( elem, i, until ) {
		return dir( elem, "previousSibling", until );
	},
	siblings: function( elem ) {
		return siblings( ( elem.parentNode || {} ).firstChild, elem );
	},
	children: function( elem ) {
		return siblings( elem.firstChild );
	},
	contents: function( elem ) {
		if ( typeof elem.contentDocument !== "undefined" ) {
			return elem.contentDocument;
		}

		// Support: IE 9 - 11 only, iOS 7 only, Android Browser <=4.3 only
		// Treat the template element as a regular one in browsers that
		// don't support it.
		if ( nodeName( elem, "template" ) ) {
			elem = elem.content || elem;
		}

		return jQuery.merge( [], elem.childNodes );
	}
}, function( name, fn ) {
	jQuery.fn[ name ] = function( until, selector ) {
		var matched = jQuery.map( this, fn, until );

		if ( name.slice( -5 ) !== "Until" ) {
			selector = until;
		}

		if ( selector && typeof selector === "string" ) {
			matched = jQuery.filter( selector, matched );
		}

		if ( this.length > 1 ) {

			// Remove duplicates
			if ( !guaranteedUnique[ name ] ) {
				jQuery.uniqueSort( matched );
			}

			// Reverse order for parents* and prev-derivatives
			if ( rparentsprev.test( name ) ) {
				matched.reverse();
			}
		}

		return this.pushStack( matched );
	};
} );
var rnothtmlwhite = ( /[^\x20\t\r\n\f]+/g );



// Convert String-formatted options into Object-formatted ones
function createOptions( options ) {
	var object = {};
	jQuery.each( options.match( rnothtmlwhite ) || [], function( _, flag ) {
		object[ flag ] = true;
	} );
	return object;
}

/*
 * Create a callback list using the following parameters:
 *
 *	options: an optional list of space-separated options that will change how
 *			the callback list behaves or a more traditional option object
 *
 * By default a callback list will act like an event callback list and can be
 * "fired" multiple times.
 *
 * Possible options:
 *
 *	once:			will ensure the callback list can only be fired once (like a Deferred)
 *
 *	memory:			will keep track of previous values and will call any callback added
 *					after the list has been fired right away with the latest "memorized"
 *					values (like a Deferred)
 *
 *	unique:			will ensure a callback can only be added once (no duplicate in the list)
 *
 *	stopOnFalse:	interrupt callings when a callback returns false
 *
 */
jQuery.Callbacks = function( options ) {

	// Convert options from String-formatted to Object-formatted if needed
	// (we check in cache first)
	options = typeof options === "string" ?
		createOptions( options ) :
		jQuery.extend( {}, options );

	var // Flag to know if list is currently firing
		firing,

		// Last fire value for non-forgettable lists
		memory,

		// Flag to know if list was already fired
		fired,

		// Flag to prevent firing
		locked,

		// Actual callback list
		list = [],

		// Queue of execution data for repeatable lists
		queue = [],

		// Index of currently firing callback (modified by add/remove as needed)
		firingIndex = -1,

		// Fire callbacks
		fire = function() {

			// Enforce single-firing
			locked = locked || options.once;

			// Execute callbacks for all pending executions,
			// respecting firingIndex overrides and runtime changes
			fired = firing = true;
			for ( ; queue.length; firingIndex = -1 ) {
				memory = queue.shift();
				while ( ++firingIndex < list.length ) {

					// Run callback and check for early termination
					if ( list[ firingIndex ].apply( memory[ 0 ], memory[ 1 ] ) === false &&
						options.stopOnFalse ) {

						// Jump to end and forget the data so .add doesn't re-fire
						firingIndex = list.length;
						memory = false;
					}
				}
			}

			// Forget the data if we're done with it
			if ( !options.memory ) {
				memory = false;
			}

			firing = false;

			// Clean up if we're done firing for good
			if ( locked ) {

				// Keep an empty list if we have data for future add calls
				if ( memory ) {
					list = [];

				// Otherwise, this object is spent
				} else {
					list = "";
				}
			}
		},

		// Actual Callbacks object
		self = {

			// Add a callback or a collection of callbacks to the list
			add: function() {
				if ( list ) {

					// If we have memory from a past run, we should fire after adding
					if ( memory && !firing ) {
						firingIndex = list.length - 1;
						queue.push( memory );
					}

					( function add( args ) {
						jQuery.each( args, function( _, arg ) {
							if ( isFunction( arg ) ) {
								if ( !options.unique || !self.has( arg ) ) {
									list.push( arg );
								}
							} else if ( arg && arg.length && toType( arg ) !== "string" ) {

								// Inspect recursively
								add( arg );
							}
						} );
					} )( arguments );

					if ( memory && !firing ) {
						fire();
					}
				}
				return this;
			},

			// Remove a callback from the list
			remove: function() {
				jQuery.each( arguments, function( _, arg ) {
					var index;
					while ( ( index = jQuery.inArray( arg, list, index ) ) > -1 ) {
						list.splice( index, 1 );

						// Handle firing indexes
						if ( index <= firingIndex ) {
							firingIndex--;
						}
					}
				} );
				return this;
			},

			// Check if a given callback is in the list.
			// If no argument is given, return whether or not list has callbacks attached.
			has: function( fn ) {
				return fn ?
					jQuery.inArray( fn, list ) > -1 :
					list.length > 0;
			},

			// Remove all callbacks from the list
			empty: function() {
				if ( list ) {
					list = [];
				}
				return this;
			},

			// Disable .fire and .add
			// Abort any current/pending executions
			// Clear all callbacks and values
			disable: function() {
				locked = queue = [];
				list = memory = "";
				return this;
			},
			disabled: function() {
				return !list;
			},

			// Disable .fire
			// Also disable .add unless we have memory (since it would have no effect)
			// Abort any pending executions
			lock: function() {
				locked = queue = [];
				if ( !memory && !firing ) {
					list = memory = "";
				}
				return this;
			},
			locked: function() {
				return !!locked;
			},

			// Call all callbacks with the given context and arguments
			fireWith: function( context, args ) {
				if ( !locked ) {
					args = args || [];
					args = [ context, args.slice ? args.slice() : args ];
					queue.push( args );
					if ( !firing ) {
						fire();
					}
				}
				return this;
			},

			// Call all the callbacks with the given arguments
			fire: function() {
				self.fireWith( this, arguments );
				return this;
			},

			// To know if the callbacks have already been called at least once
			fired: function() {
				return !!fired;
			}
		};

	return self;
};


function Identity( v ) {
	return v;
}
function Thrower( ex ) {
	throw ex;
}

function adoptValue( value, resolve, reject, noValue ) {
	var method;

	try {

		// Check for promise aspect first to privilege synchronous behavior
		if ( value && isFunction( ( method = value.promise ) ) ) {
			method.call( value ).done( resolve ).fail( reject );

		// Other thenables
		} else if ( value && isFunction( ( method = value.then ) ) ) {
			method.call( value, resolve, reject );

		// Other non-thenables
		} else {

			// Control `resolve` arguments by letting Array#slice cast boolean `noValue` to integer:
			// * false: [ value ].slice( 0 ) => resolve( value )
			// * true: [ value ].slice( 1 ) => resolve()
			resolve.apply( undefined, [ value ].slice( noValue ) );
		}

	// For Promises/A+, convert exceptions into rejections
	// Since jQuery.when doesn't unwrap thenables, we can skip the extra checks appearing in
	// Deferred#then to conditionally suppress rejection.
	} catch ( value ) {

		// Support: Android 4.0 only
		// Strict mode functions invoked without .call/.apply get global-object context
		reject.apply( undefined, [ value ] );
	}
}

jQuery.extend( {

	Deferred: function( func ) {
		var tuples = [

				// action, add listener, callbacks,
				// ... .then handlers, argument index, [final state]
				[ "notify", "progress", jQuery.Callbacks( "memory" ),
					jQuery.Callbacks( "memory" ), 2 ],
				[ "resolve", "done", jQuery.Callbacks( "once memory" ),
					jQuery.Callbacks( "once memory" ), 0, "resolved" ],
				[ "reject", "fail", jQuery.Callbacks( "once memory" ),
					jQuery.Callbacks( "once memory" ), 1, "rejected" ]
			],
			state = "pending",
			promise = {
				state: function() {
					return state;
				},
				always: function() {
					deferred.done( arguments ).fail( arguments );
					return this;
				},
				"catch": function( fn ) {
					return promise.then( null, fn );
				},

				// Keep pipe for back-compat
				pipe: function( /* fnDone, fnFail, fnProgress */ ) {
					var fns = arguments;

					return jQuery.Deferred( function( newDefer ) {
						jQuery.each( tuples, function( i, tuple ) {

							// Map tuples (progress, done, fail) to arguments (done, fail, progress)
							var fn = isFunction( fns[ tuple[ 4 ] ] ) && fns[ tuple[ 4 ] ];

							// deferred.progress(function() { bind to newDefer or newDefer.notify })
							// deferred.done(function() { bind to newDefer or newDefer.resolve })
							// deferred.fail(function() { bind to newDefer or newDefer.reject })
							deferred[ tuple[ 1 ] ]( function() {
								var returned = fn && fn.apply( this, arguments );
								if ( returned && isFunction( returned.promise ) ) {
									returned.promise()
										.progress( newDefer.notify )
										.done( newDefer.resolve )
										.fail( newDefer.reject );
								} else {
									newDefer[ tuple[ 0 ] + "With" ](
										this,
										fn ? [ returned ] : arguments
									);
								}
							} );
						} );
						fns = null;
					} ).promise();
				},
				then: function( onFulfilled, onRejected, onProgress ) {
					var maxDepth = 0;
					function resolve( depth, deferred, handler, special ) {
						return function() {
							var that = this,
								args = arguments,
								mightThrow = function() {
									var returned, then;

									// Support: Promises/A+ section 2.3.3.3.3
									// https://promisesaplus.com/#point-59
									// Ignore double-resolution attempts
									if ( depth < maxDepth ) {
										return;
									}

									returned = handler.apply( that, args );

									// Support: Promises/A+ section 2.3.1
									// https://promisesaplus.com/#point-48
									if ( returned === deferred.promise() ) {
										throw new TypeError( "Thenable self-resolution" );
									}

									// Support: Promises/A+ sections 2.3.3.1, 3.5
									// https://promisesaplus.com/#point-54
									// https://promisesaplus.com/#point-75
									// Retrieve `then` only once
									then = returned &&

										// Support: Promises/A+ section 2.3.4
										// https://promisesaplus.com/#point-64
										// Only check objects and functions for thenability
										( typeof returned === "object" ||
											typeof returned === "function" ) &&
										returned.then;

									// Handle a returned thenable
									if ( isFunction( then ) ) {

										// Special processors (notify) just wait for resolution
										if ( special ) {
											then.call(
												returned,
												resolve( maxDepth, deferred, Identity, special ),
												resolve( maxDepth, deferred, Thrower, special )
											);

										// Normal processors (resolve) also hook into progress
										} else {

											// ...and disregard older resolution values
											maxDepth++;

											then.call(
												returned,
												resolve( maxDepth, deferred, Identity, special ),
												resolve( maxDepth, deferred, Thrower, special ),
												resolve( maxDepth, deferred, Identity,
													deferred.notifyWith )
											);
										}

									// Handle all other returned values
									} else {

										// Only substitute handlers pass on context
										// and multiple values (non-spec behavior)
										if ( handler !== Identity ) {
											that = undefined;
											args = [ returned ];
										}

										// Process the value(s)
										// Default process is resolve
										( special || deferred.resolveWith )( that, args );
									}
								},

								// Only normal processors (resolve) catch and reject exceptions
								process = special ?
									mightThrow :
									function() {
										try {
											mightThrow();
										} catch ( e ) {

											if ( jQuery.Deferred.exceptionHook ) {
												jQuery.Deferred.exceptionHook( e,
													process.stackTrace );
											}

											// Support: Promises/A+ section 2.3.3.3.4.1
											// https://promisesaplus.com/#point-61
											// Ignore post-resolution exceptions
											if ( depth + 1 >= maxDepth ) {

												// Only substitute handlers pass on context
												// and multiple values (non-spec behavior)
												if ( handler !== Thrower ) {
													that = undefined;
													args = [ e ];
												}

												deferred.rejectWith( that, args );
											}
										}
									};

							// Support: Promises/A+ section 2.3.3.3.1
							// https://promisesaplus.com/#point-57
							// Re-resolve promises immediately to dodge false rejection from
							// subsequent errors
							if ( depth ) {
								process();
							} else {

								// Call an optional hook to record the stack, in case of exception
								// since it's otherwise lost when execution goes async
								if ( jQuery.Deferred.getStackHook ) {
									process.stackTrace = jQuery.Deferred.getStackHook();
								}
								window.setTimeout( process );
							}
						};
					}

					return jQuery.Deferred( function( newDefer ) {

						// progress_handlers.add( ... )
						tuples[ 0 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								isFunction( onProgress ) ?
									onProgress :
									Identity,
								newDefer.notifyWith
							)
						);

						// fulfilled_handlers.add( ... )
						tuples[ 1 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								isFunction( onFulfilled ) ?
									onFulfilled :
									Identity
							)
						);

						// rejected_handlers.add( ... )
						tuples[ 2 ][ 3 ].add(
							resolve(
								0,
								newDefer,
								isFunction( onRejected ) ?
									onRejected :
									Thrower
							)
						);
					} ).promise();
				},

				// Get a promise for this deferred
				// If obj is provided, the promise aspect is added to the object
				promise: function( obj ) {
					return obj != null ? jQuery.extend( obj, promise ) : promise;
				}
			},
			deferred = {};

		// Add list-specific methods
		jQuery.each( tuples, function( i, tuple ) {
			var list = tuple[ 2 ],
				stateString = tuple[ 5 ];

			// promise.progress = list.add
			// promise.done = list.add
			// promise.fail = list.add
			promise[ tuple[ 1 ] ] = list.add;

			// Handle state
			if ( stateString ) {
				list.add(
					function() {

						// state = "resolved" (i.e., fulfilled)
						// state = "rejected"
						state = stateString;
					},

					// rejected_callbacks.disable
					// fulfilled_callbacks.disable
					tuples[ 3 - i ][ 2 ].disable,

					// rejected_handlers.disable
					// fulfilled_handlers.disable
					tuples[ 3 - i ][ 3 ].disable,

					// progress_callbacks.lock
					tuples[ 0 ][ 2 ].lock,

					// progress_handlers.lock
					tuples[ 0 ][ 3 ].lock
				);
			}

			// progress_handlers.fire
			// fulfilled_handlers.fire
			// rejected_handlers.fire
			list.add( tuple[ 3 ].fire );

			// deferred.notify = function() { deferred.notifyWith(...) }
			// deferred.resolve = function() { deferred.resolveWith(...) }
			// deferred.reject = function() { deferred.rejectWith(...) }
			deferred[ tuple[ 0 ] ] = function() {
				deferred[ tuple[ 0 ] + "With" ]( this === deferred ? undefined : this, arguments );
				return this;
			};

			// deferred.notifyWith = list.fireWith
			// deferred.resolveWith = list.fireWith
			// deferred.rejectWith = list.fireWith
			deferred[ tuple[ 0 ] + "With" ] = list.fireWith;
		} );

		// Make the deferred a promise
		promise.promise( deferred );

		// Call given func if any
		if ( func ) {
			func.call( deferred, deferred );
		}

		// All done!
		return deferred;
	},

	// Deferred helper
	when: function( singleValue ) {
		var

			// count of uncompleted subordinates
			remaining = arguments.length,

			// count of unprocessed arguments
			i = remaining,

			// subordinate fulfillment data
			resolveContexts = Array( i ),
			resolveValues = slice.call( arguments ),

			// the master Deferred
			master = jQuery.Deferred(),

			// subordinate callback factory
			updateFunc = function( i ) {
				return function( value ) {
					resolveContexts[ i ] = this;
					resolveValues[ i ] = arguments.length > 1 ? slice.call( arguments ) : value;
					if ( !( --remaining ) ) {
						master.resolveWith( resolveContexts, resolveValues );
					}
				};
			};

		// Single- and empty arguments are adopted like Promise.resolve
		if ( remaining <= 1 ) {
			adoptValue( singleValue, master.done( updateFunc( i ) ).resolve, master.reject,
				!remaining );

			// Use .then() to unwrap secondary thenables (cf. gh-3000)
			if ( master.state() === "pending" ||
				isFunction( resolveValues[ i ] && resolveValues[ i ].then ) ) {

				return master.then();
			}
		}

		// Multiple arguments are aggregated like Promise.all array elements
		while ( i-- ) {
			adoptValue( resolveValues[ i ], updateFunc( i ), master.reject );
		}

		return master.promise();
	}
} );


// These usually indicate a programmer mistake during development,
// warn about them ASAP rather than swallowing them by default.
var rerrorNames = /^(Eval|Internal|Range|Reference|Syntax|Type|URI)Error$/;

jQuery.Deferred.exceptionHook = function( error, stack ) {

	// Support: IE 8 - 9 only
	// Console exists when dev tools are open, which can happen at any time
	if ( window.console && window.console.warn && error && rerrorNames.test( error.name ) ) {
		window.console.warn( "jQuery.Deferred exception: " + error.message, error.stack, stack );
	}
};




jQuery.readyException = function( error ) {
	window.setTimeout( function() {
		throw error;
	} );
};




// The deferred used on DOM ready
var readyList = jQuery.Deferred();

jQuery.fn.ready = function( fn ) {

	readyList
		.then( fn )

		// Wrap jQuery.readyException in a function so that the lookup
		// happens at the time of error handling instead of callback
		// registration.
		.catch( function( error ) {
			jQuery.readyException( error );
		} );

	return this;
};

jQuery.extend( {

	// Is the DOM ready to be used? Set to true once it occurs.
	isReady: false,

	// A counter to track how many items to wait for before
	// the ready event fires. See #6781
	readyWait: 1,

	// Handle when the DOM is ready
	ready: function( wait ) {

		// Abort if there are pending holds or we're already ready
		if ( wait === true ? --jQuery.readyWait : jQuery.isReady ) {
			return;
		}

		// Remember that the DOM is ready
		jQuery.isReady = true;

		// If a normal DOM Ready event fired, decrement, and wait if need be
		if ( wait !== true && --jQuery.readyWait > 0 ) {
			return;
		}

		// If there are functions bound, to execute
		readyList.resolveWith( document, [ jQuery ] );
	}
} );

jQuery.ready.then = readyList.then;

// The ready event handler and self cleanup method
function completed() {
	document.removeEventListener( "DOMContentLoaded", completed );
	window.removeEventListener( "load", completed );
	jQuery.ready();
}

// Catch cases where $(document).ready() is called
// after the browser event has already occurred.
// Support: IE <=9 - 10 only
// Older IE sometimes signals "interactive" too soon
if ( document.readyState === "complete" ||
	( document.readyState !== "loading" && !document.documentElement.doScroll ) ) {

	// Handle it asynchronously to allow scripts the opportunity to delay ready
	window.setTimeout( jQuery.ready );

} else {

	// Use the handy event callback
	document.addEventListener( "DOMContentLoaded", completed );

	// A fallback to window.onload, that will always work
	window.addEventListener( "load", completed );
}




// Multifunctional method to get and set values of a collection
// The value/s can optionally be executed if it's a function
var access = function( elems, fn, key, value, chainable, emptyGet, raw ) {
	var i = 0,
		len = elems.length,
		bulk = key == null;

	// Sets many values
	if ( toType( key ) === "object" ) {
		chainable = true;
		for ( i in key ) {
			access( elems, fn, i, key[ i ], true, emptyGet, raw );
		}

	// Sets one value
	} else if ( value !== undefined ) {
		chainable = true;

		if ( !isFunction( value ) ) {
			raw = true;
		}

		if ( bulk ) {

			// Bulk operations run against the entire set
			if ( raw ) {
				fn.call( elems, value );
				fn = null;

			// ...except when executing function values
			} else {
				bulk = fn;
				fn = function( elem, key, value ) {
					return bulk.call( jQuery( elem ), value );
				};
			}
		}

		if ( fn ) {
			for ( ; i < len; i++ ) {
				fn(
					elems[ i ], key, raw ?
					value :
					value.call( elems[ i ], i, fn( elems[ i ], key ) )
				);
			}
		}
	}

	if ( chainable ) {
		return elems;
	}

	// Gets
	if ( bulk ) {
		return fn.call( elems );
	}

	return len ? fn( elems[ 0 ], key ) : emptyGet;
};


// Matches dashed string for camelizing
var rmsPrefix = /^-ms-/,
	rdashAlpha = /-([a-z])/g;

// Used by camelCase as callback to replace()
function fcamelCase( all, letter ) {
	return letter.toUpperCase();
}

// Convert dashed to camelCase; used by the css and data modules
// Support: IE <=9 - 11, Edge 12 - 15
// Microsoft forgot to hump their vendor prefix (#9572)
function camelCase( string ) {
	return string.replace( rmsPrefix, "ms-" ).replace( rdashAlpha, fcamelCase );
}
var acceptData = function( owner ) {

	// Accepts only:
	//  - Node
	//    - Node.ELEMENT_NODE
	//    - Node.DOCUMENT_NODE
	//  - Object
	//    - Any
	return owner.nodeType === 1 || owner.nodeType === 9 || !( +owner.nodeType );
};




function Data() {
	this.expando = jQuery.expando + Data.uid++;
}

Data.uid = 1;

Data.prototype = {

	cache: function( owner ) {

		// Check if the owner object already has a cache
		var value = owner[ this.expando ];

		// If not, create one
		if ( !value ) {
			value = {};

			// We can accept data for non-element nodes in modern browsers,
			// but we should not, see #8335.
			// Always return an empty object.
			if ( acceptData( owner ) ) {

				// If it is a node unlikely to be stringify-ed or looped over
				// use plain assignment
				if ( owner.nodeType ) {
					owner[ this.expando ] = value;

				// Otherwise secure it in a non-enumerable property
				// configurable must be true to allow the property to be
				// deleted when data is removed
				} else {
					Object.defineProperty( owner, this.expando, {
						value: value,
						configurable: true
					} );
				}
			}
		}

		return value;
	},
	set: function( owner, data, value ) {
		var prop,
			cache = this.cache( owner );

		// Handle: [ owner, key, value ] args
		// Always use camelCase key (gh-2257)
		if ( typeof data === "string" ) {
			cache[ camelCase( data ) ] = value;

		// Handle: [ owner, { properties } ] args
		} else {

			// Copy the properties one-by-one to the cache object
			for ( prop in data ) {
				cache[ camelCase( prop ) ] = data[ prop ];
			}
		}
		return cache;
	},
	get: function( owner, key ) {
		return key === undefined ?
			this.cache( owner ) :

			// Always use camelCase key (gh-2257)
			owner[ this.expando ] && owner[ this.expando ][ camelCase( key ) ];
	},
	access: function( owner, key, value ) {

		// In cases where either:
		//
		//   1. No key was specified
		//   2. A string key was specified, but no value provided
		//
		// Take the "read" path and allow the get method to determine
		// which value to return, respectively either:
		//
		//   1. The entire cache object
		//   2. The data stored at the key
		//
		if ( key === undefined ||
				( ( key && typeof key === "string" ) && value === undefined ) ) {

			return this.get( owner, key );
		}

		// When the key is not a string, or both a key and value
		// are specified, set or extend (existing objects) with either:
		//
		//   1. An object of properties
		//   2. A key and value
		//
		this.set( owner, key, value );

		// Since the "set" path can have two possible entry points
		// return the expected data based on which path was taken[*]
		return value !== undefined ? value : key;
	},
	remove: function( owner, key ) {
		var i,
			cache = owner[ this.expando ];

		if ( cache === undefined ) {
			return;
		}

		if ( key !== undefined ) {

			// Support array or space separated string of keys
			if ( Array.isArray( key ) ) {

				// If key is an array of keys...
				// We always set camelCase keys, so remove that.
				key = key.map( camelCase );
			} else {
				key = camelCase( key );

				// If a key with the spaces exists, use it.
				// Otherwise, create an array by matching non-whitespace
				key = key in cache ?
					[ key ] :
					( key.match( rnothtmlwhite ) || [] );
			}

			i = key.length;

			while ( i-- ) {
				delete cache[ key[ i ] ];
			}
		}

		// Remove the expando if there's no more data
		if ( key === undefined || jQuery.isEmptyObject( cache ) ) {

			// Support: Chrome <=35 - 45
			// Webkit & Blink performance suffers when deleting properties
			// from DOM nodes, so set to undefined instead
			// https://bugs.chromium.org/p/chromium/issues/detail?id=378607 (bug restricted)
			if ( owner.nodeType ) {
				owner[ this.expando ] = undefined;
			} else {
				delete owner[ this.expando ];
			}
		}
	},
	hasData: function( owner ) {
		var cache = owner[ this.expando ];
		return cache !== undefined && !jQuery.isEmptyObject( cache );
	}
};
var dataPriv = new Data();

var dataUser = new Data();



//	Implementation Summary
//
//	1. Enforce API surface and semantic compatibility with 1.9.x branch
//	2. Improve the module's maintainability by reducing the storage
//		paths to a single mechanism.
//	3. Use the same single mechanism to support "private" and "user" data.
//	4. _Never_ expose "private" data to user code (TODO: Drop _data, _removeData)
//	5. Avoid exposing implementation details on user objects (eg. expando properties)
//	6. Provide a clear path for implementation upgrade to WeakMap in 2014

var rbrace = /^(?:\{[\w\W]*\}|\[[\w\W]*\])$/,
	rmultiDash = /[A-Z]/g;

function getData( data ) {
	if ( data === "true" ) {
		return true;
	}

	if ( data === "false" ) {
		return false;
	}

	if ( data === "null" ) {
		return null;
	}

	// Only convert to a number if it doesn't change the string
	if ( data === +data + "" ) {
		return +data;
	}

	if ( rbrace.test( data ) ) {
		return JSON.parse( data );
	}

	return data;
}

function dataAttr( elem, key, data ) {
	var name;

	// If nothing was found internally, try to fetch any
	// data from the HTML5 data-* attribute
	if ( data === undefined && elem.nodeType === 1 ) {
		name = "data-" + key.replace( rmultiDash, "-$&" ).toLowerCase();
		data = elem.getAttribute( name );

		if ( typeof data === "string" ) {
			try {
				data = getData( data );
			} catch ( e ) {}

			// Make sure we set the data so it isn't changed later
			dataUser.set( elem, key, data );
		} else {
			data = undefined;
		}
	}
	return data;
}

jQuery.extend( {
	hasData: function( elem ) {
		return dataUser.hasData( elem ) || dataPriv.hasData( elem );
	},

	data: function( elem, name, data ) {
		return dataUser.access( elem, name, data );
	},

	removeData: function( elem, name ) {
		dataUser.remove( elem, name );
	},

	// TODO: Now that all calls to _data and _removeData have been replaced
	// with direct calls to dataPriv methods, these can be deprecated.
	_data: function( elem, name, data ) {
		return dataPriv.access( elem, name, data );
	},

	_removeData: function( elem, name ) {
		dataPriv.remove( elem, name );
	}
} );

jQuery.fn.extend( {
	data: function( key, value ) {
		var i, name, data,
			elem = this[ 0 ],
			attrs = elem && elem.attributes;

		// Gets all values
		if ( key === undefined ) {
			if ( this.length ) {
				data = dataUser.get( elem );

				if ( elem.nodeType === 1 && !dataPriv.get( elem, "hasDataAttrs" ) ) {
					i = attrs.length;
					while ( i-- ) {

						// Support: IE 11 only
						// The attrs elements can be null (#14894)
						if ( attrs[ i ] ) {
							name = attrs[ i ].name;
							if ( name.indexOf( "data-" ) === 0 ) {
								name = camelCase( name.slice( 5 ) );
								dataAttr( elem, name, data[ name ] );
							}
						}
					}
					dataPriv.set( elem, "hasDataAttrs", true );
				}
			}

			return data;
		}

		// Sets multiple values
		if ( typeof key === "object" ) {
			return this.each( function() {
				dataUser.set( this, key );
			} );
		}

		return access( this, function( value ) {
			var data;

			// The calling jQuery object (element matches) is not empty
			// (and therefore has an element appears at this[ 0 ]) and the
			// `value` parameter was not undefined. An empty jQuery object
			// will result in `undefined` for elem = this[ 0 ] which will
			// throw an exception if an attempt to read a data cache is made.
			if ( elem && value === undefined ) {

				// Attempt to get data from the cache
				// The key will always be camelCased in Data
				data = dataUser.get( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// Attempt to "discover" the data in
				// HTML5 custom data-* attrs
				data = dataAttr( elem, key );
				if ( data !== undefined ) {
					return data;
				}

				// We tried really hard, but the data doesn't exist.
				return;
			}

			// Set the data...
			this.each( function() {

				// We always store the camelCased key
				dataUser.set( this, key, value );
			} );
		}, null, value, arguments.length > 1, null, true );
	},

	removeData: function( key ) {
		return this.each( function() {
			dataUser.remove( this, key );
		} );
	}
} );


jQuery.extend( {
	queue: function( elem, type, data ) {
		var queue;

		if ( elem ) {
			type = ( type || "fx" ) + "queue";
			queue = dataPriv.get( elem, type );

			// Speed up dequeue by getting out quickly if this is just a lookup
			if ( data ) {
				if ( !queue || Array.isArray( data ) ) {
					queue = dataPriv.access( elem, type, jQuery.makeArray( data ) );
				} else {
					queue.push( data );
				}
			}
			return queue || [];
		}
	},

	dequeue: function( elem, type ) {
		type = type || "fx";

		var queue = jQuery.queue( elem, type ),
			startLength = queue.length,
			fn = queue.shift(),
			hooks = jQuery._queueHooks( elem, type ),
			next = function() {
				jQuery.dequeue( elem, type );
			};

		// If the fx queue is dequeued, always remove the progress sentinel
		if ( fn === "inprogress" ) {
			fn = queue.shift();
			startLength--;
		}

		if ( fn ) {

			// Add a progress sentinel to prevent the fx queue from being
			// automatically dequeued
			if ( type === "fx" ) {
				queue.unshift( "inprogress" );
			}

			// Clear up the last queue stop function
			delete hooks.stop;
			fn.call( elem, next, hooks );
		}

		if ( !startLength && hooks ) {
			hooks.empty.fire();
		}
	},

	// Not public - generate a queueHooks object, or return the current one
	_queueHooks: function( elem, type ) {
		var key = type + "queueHooks";
		return dataPriv.get( elem, key ) || dataPriv.access( elem, key, {
			empty: jQuery.Callbacks( "once memory" ).add( function() {
				dataPriv.remove( elem, [ type + "queue", key ] );
			} )
		} );
	}
} );

jQuery.fn.extend( {
	queue: function( type, data ) {
		var setter = 2;

		if ( typeof type !== "string" ) {
			data = type;
			type = "fx";
			setter--;
		}

		if ( arguments.length < setter ) {
			return jQuery.queue( this[ 0 ], type );
		}

		return data === undefined ?
			this :
			this.each( function() {
				var queue = jQuery.queue( this, type, data );

				// Ensure a hooks for this queue
				jQuery._queueHooks( this, type );

				if ( type === "fx" && queue[ 0 ] !== "inprogress" ) {
					jQuery.dequeue( this, type );
				}
			} );
	},
	dequeue: function( type ) {
		return this.each( function() {
			jQuery.dequeue( this, type );
		} );
	},
	clearQueue: function( type ) {
		return this.queue( type || "fx", [] );
	},

	// Get a promise resolved when queues of a certain type
	// are emptied (fx is the type by default)
	promise: function( type, obj ) {
		var tmp,
			count = 1,
			defer = jQuery.Deferred(),
			elements = this,
			i = this.length,
			resolve = function() {
				if ( !( --count ) ) {
					defer.resolveWith( elements, [ elements ] );
				}
			};

		if ( typeof type !== "string" ) {
			obj = type;
			type = undefined;
		}
		type = type || "fx";

		while ( i-- ) {
			tmp = dataPriv.get( elements[ i ], type + "queueHooks" );
			if ( tmp && tmp.empty ) {
				count++;
				tmp.empty.add( resolve );
			}
		}
		resolve();
		return defer.promise( obj );
	}
} );
var pnum = ( /[+-]?(?:\d*\.|)\d+(?:[eE][+-]?\d+|)/ ).source;

var rcssNum = new RegExp( "^(?:([+-])=|)(" + pnum + ")([a-z%]*)$", "i" );


var cssExpand = [ "Top", "Right", "Bottom", "Left" ];

var documentElement = document.documentElement;



	var isAttached = function( elem ) {
			return jQuery.contains( elem.ownerDocument, elem );
		},
		composed = { composed: true };

	// Support: IE 9 - 11+, Edge 12 - 18+, iOS 10.0 - 10.2 only
	// Check attachment across shadow DOM boundaries when possible (gh-3504)
	// Support: iOS 10.0-10.2 only
	// Early iOS 10 versions support `attachShadow` but not `getRootNode`,
	// leading to errors. We need to check for `getRootNode`.
	if ( documentElement.getRootNode ) {
		isAttached = function( elem ) {
			return jQuery.contains( elem.ownerDocument, elem ) ||
				elem.getRootNode( composed ) === elem.ownerDocument;
		};
	}
var isHiddenWithinTree = function( elem, el ) {

		// isHiddenWithinTree might be called from jQuery#filter function;
		// in that case, element will be second argument
		elem = el || elem;

		// Inline style trumps all
		return elem.style.display === "none" ||
			elem.style.display === "" &&

			// Otherwise, check computed style
			// Support: Firefox <=43 - 45
			// Disconnected elements can have computed display: none, so first confirm that elem is
			// in the document.
			isAttached( elem ) &&

			jQuery.css( elem, "display" ) === "none";
	};

var swap = function( elem, options, callback, args ) {
	var ret, name,
		old = {};

	// Remember the old values, and insert the new ones
	for ( name in options ) {
		old[ name ] = elem.style[ name ];
		elem.style[ name ] = options[ name ];
	}

	ret = callback.apply( elem, args || [] );

	// Revert the old values
	for ( name in options ) {
		elem.style[ name ] = old[ name ];
	}

	return ret;
};




function adjustCSS( elem, prop, valueParts, tween ) {
	var adjusted, scale,
		maxIterations = 20,
		currentValue = tween ?
			function() {
				return tween.cur();
			} :
			function() {
				return jQuery.css( elem, prop, "" );
			},
		initial = currentValue(),
		unit = valueParts && valueParts[ 3 ] || ( jQuery.cssNumber[ prop ] ? "" : "px" ),

		// Starting value computation is required for potential unit mismatches
		initialInUnit = elem.nodeType &&
			( jQuery.cssNumber[ prop ] || unit !== "px" && +initial ) &&
			rcssNum.exec( jQuery.css( elem, prop ) );

	if ( initialInUnit && initialInUnit[ 3 ] !== unit ) {

		// Support: Firefox <=54
		// Halve the iteration target value to prevent interference from CSS upper bounds (gh-2144)
		initial = initial / 2;

		// Trust units reported by jQuery.css
		unit = unit || initialInUnit[ 3 ];

		// Iteratively approximate from a nonzero starting point
		initialInUnit = +initial || 1;

		while ( maxIterations-- ) {

			// Evaluate and update our best guess (doubling guesses that zero out).
			// Finish if the scale equals or crosses 1 (making the old*new product non-positive).
			jQuery.style( elem, prop, initialInUnit + unit );
			if ( ( 1 - scale ) * ( 1 - ( scale = currentValue() / initial || 0.5 ) ) <= 0 ) {
				maxIterations = 0;
			}
			initialInUnit = initialInUnit / scale;

		}

		initialInUnit = initialInUnit * 2;
		jQuery.style( elem, prop, initialInUnit + unit );

		// Make sure we update the tween properties later on
		valueParts = valueParts || [];
	}

	if ( valueParts ) {
		initialInUnit = +initialInUnit || +initial || 0;

		// Apply relative offset (+=/-=) if specified
		adjusted = valueParts[ 1 ] ?
			initialInUnit + ( valueParts[ 1 ] + 1 ) * valueParts[ 2 ] :
			+valueParts[ 2 ];
		if ( tween ) {
			tween.unit = unit;
			tween.start = initialInUnit;
			tween.end = adjusted;
		}
	}
	return adjusted;
}


var defaultDisplayMap = {};

function getDefaultDisplay( elem ) {
	var temp,
		doc = elem.ownerDocument,
		nodeName = elem.nodeName,
		display = defaultDisplayMap[ nodeName ];

	if ( display ) {
		return display;
	}

	temp = doc.body.appendChild( doc.createElement( nodeName ) );
	display = jQuery.css( temp, "display" );

	temp.parentNode.removeChild( temp );

	if ( display === "none" ) {
		display = "block";
	}
	defaultDisplayMap[ nodeName ] = display;

	return display;
}

function showHide( elements, show ) {
	var display, elem,
		values = [],
		index = 0,
		length = elements.length;

	// Determine new display value for elements that need to change
	for ( ; index < length; index++ ) {
		elem = elements[ index ];
		if ( !elem.style ) {
			continue;
		}

		display = elem.style.display;
		if ( show ) {

			// Since we force visibility upon cascade-hidden elements, an immediate (and slow)
			// check is required in this first loop unless we have a nonempty display value (either
			// inline or about-to-be-restored)
			if ( display === "none" ) {
				values[ index ] = dataPriv.get( elem, "display" ) || null;
				if ( !values[ index ] ) {
					elem.style.display = "";
				}
			}
			if ( elem.style.display === "" && isHiddenWithinTree( elem ) ) {
				values[ index ] = getDefaultDisplay( elem );
			}
		} else {
			if ( display !== "none" ) {
				values[ index ] = "none";

				// Remember what we're overwriting
				dataPriv.set( elem, "display", display );
			}
		}
	}

	// Set the display of the elements in a second loop to avoid constant reflow
	for ( index = 0; index < length; index++ ) {
		if ( values[ index ] != null ) {
			elements[ index ].style.display = values[ index ];
		}
	}

	return elements;
}

jQuery.fn.extend( {
	show: function() {
		return showHide( this, true );
	},
	hide: function() {
		return showHide( this );
	},
	toggle: function( state ) {
		if ( typeof state === "boolean" ) {
			return state ? this.show() : this.hide();
		}

		return this.each( function() {
			if ( isHiddenWithinTree( this ) ) {
				jQuery( this ).show();
			} else {
				jQuery( this ).hide();
			}
		} );
	}
} );
var rcheckableType = ( /^(?:checkbox|radio)$/i );

var rtagName = ( /<([a-z][^\/\0>\x20\t\r\n\f]*)/i );

var rscriptType = ( /^$|^module$|\/(?:java|ecma)script/i );



// We have to close these tags to support XHTML (#13200)
var wrapMap = {

	// Support: IE <=9 only
	option: [ 1, "<select multiple='multiple'>", "</select>" ],

	// XHTML parsers do not magically insert elements in the
	// same way that tag soup parsers do. So we cannot shorten
	// this by omitting <tbody> or other required elements.
	thead: [ 1, "<table>", "</table>" ],
	col: [ 2, "<table><colgroup>", "</colgroup></table>" ],
	tr: [ 2, "<table><tbody>", "</tbody></table>" ],
	td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],

	_default: [ 0, "", "" ]
};

// Support: IE <=9 only
wrapMap.optgroup = wrapMap.option;

wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead;
wrapMap.th = wrapMap.td;


function getAll( context, tag ) {

	// Support: IE <=9 - 11 only
	// Use typeof to avoid zero-argument method invocation on host objects (#15151)
	var ret;

	if ( typeof context.getElementsByTagName !== "undefined" ) {
		ret = context.getElementsByTagName( tag || "*" );

	} else if ( typeof context.querySelectorAll !== "undefined" ) {
		ret = context.querySelectorAll( tag || "*" );

	} else {
		ret = [];
	}

	if ( tag === undefined || tag && nodeName( context, tag ) ) {
		return jQuery.merge( [ context ], ret );
	}

	return ret;
}


// Mark scripts as having already been evaluated
function setGlobalEval( elems, refElements ) {
	var i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		dataPriv.set(
			elems[ i ],
			"globalEval",
			!refElements || dataPriv.get( refElements[ i ], "globalEval" )
		);
	}
}


var rhtml = /<|&#?\w+;/;

function buildFragment( elems, context, scripts, selection, ignored ) {
	var elem, tmp, tag, wrap, attached, j,
		fragment = context.createDocumentFragment(),
		nodes = [],
		i = 0,
		l = elems.length;

	for ( ; i < l; i++ ) {
		elem = elems[ i ];

		if ( elem || elem === 0 ) {

			// Add nodes directly
			if ( toType( elem ) === "object" ) {

				// Support: Android <=4.0 only, PhantomJS 1 only
				// push.apply(_, arraylike) throws on ancient WebKit
				jQuery.merge( nodes, elem.nodeType ? [ elem ] : elem );

			// Convert non-html into a text node
			} else if ( !rhtml.test( elem ) ) {
				nodes.push( context.createTextNode( elem ) );

			// Convert html into DOM nodes
			} else {
				tmp = tmp || fragment.appendChild( context.createElement( "div" ) );

				// Deserialize a standard representation
				tag = ( rtagName.exec( elem ) || [ "", "" ] )[ 1 ].toLowerCase();
				wrap = wrapMap[ tag ] || wrapMap._default;
				tmp.innerHTML = wrap[ 1 ] + jQuery.htmlPrefilter( elem ) + wrap[ 2 ];

				// Descend through wrappers to the right content
				j = wrap[ 0 ];
				while ( j-- ) {
					tmp = tmp.lastChild;
				}

				// Support: Android <=4.0 only, PhantomJS 1 only
				// push.apply(_, arraylike) throws on ancient WebKit
				jQuery.merge( nodes, tmp.childNodes );

				// Remember the top-level container
				tmp = fragment.firstChild;

				// Ensure the created nodes are orphaned (#12392)
				tmp.textContent = "";
			}
		}
	}

	// Remove wrapper from fragment
	fragment.textContent = "";

	i = 0;
	while ( ( elem = nodes[ i++ ] ) ) {

		// Skip elements already in the context collection (trac-4087)
		if ( selection && jQuery.inArray( elem, selection ) > -1 ) {
			if ( ignored ) {
				ignored.push( elem );
			}
			continue;
		}

		attached = isAttached( elem );

		// Append to fragment
		tmp = getAll( fragment.appendChild( elem ), "script" );

		// Preserve script evaluation history
		if ( attached ) {
			setGlobalEval( tmp );
		}

		// Capture executables
		if ( scripts ) {
			j = 0;
			while ( ( elem = tmp[ j++ ] ) ) {
				if ( rscriptType.test( elem.type || "" ) ) {
					scripts.push( elem );
				}
			}
		}
	}

	return fragment;
}


( function() {
	var fragment = document.createDocumentFragment(),
		div = fragment.appendChild( document.createElement( "div" ) ),
		input = document.createElement( "input" );

	// Support: Android 4.0 - 4.3 only
	// Check state lost if the name is set (#11217)
	// Support: Windows Web Apps (WWA)
	// `name` and `type` must use .setAttribute for WWA (#14901)
	input.setAttribute( "type", "radio" );
	input.setAttribute( "checked", "checked" );
	input.setAttribute( "name", "t" );

	div.appendChild( input );

	// Support: Android <=4.1 only
	// Older WebKit doesn't clone checked state correctly in fragments
	support.checkClone = div.cloneNode( true ).cloneNode( true ).lastChild.checked;

	// Support: IE <=11 only
	// Make sure textarea (and checkbox) defaultValue is properly cloned
	div.innerHTML = "<textarea>x</textarea>";
	support.noCloneChecked = !!div.cloneNode( true ).lastChild.defaultValue;
} )();


var
	rkeyEvent = /^key/,
	rmouseEvent = /^(?:mouse|pointer|contextmenu|drag|drop)|click/,
	rtypenamespace = /^([^.]*)(?:\.(.+)|)/;

function returnTrue() {
	return true;
}

function returnFalse() {
	return false;
}

// Support: IE <=9 - 11+
// focus() and blur() are asynchronous, except when they are no-op.
// So expect focus to be synchronous when the element is already active,
// and blur to be synchronous when the element is not already active.
// (focus and blur are always synchronous in other supported browsers,
// this just defines when we can count on it).
function expectSync( elem, type ) {
	return ( elem === safeActiveElement() ) === ( type === "focus" );
}

// Support: IE <=9 only
// Accessing document.activeElement can throw unexpectedly
// https://bugs.jquery.com/ticket/13393
function safeActiveElement() {
	try {
		return document.activeElement;
	} catch ( err ) { }
}

function on( elem, types, selector, data, fn, one ) {
	var origFn, type;

	// Types can be a map of types/handlers
	if ( typeof types === "object" ) {

		// ( types-Object, selector, data )
		if ( typeof selector !== "string" ) {

			// ( types-Object, data )
			data = data || selector;
			selector = undefined;
		}
		for ( type in types ) {
			on( elem, type, selector, data, types[ type ], one );
		}
		return elem;
	}

	if ( data == null && fn == null ) {

		// ( types, fn )
		fn = selector;
		data = selector = undefined;
	} else if ( fn == null ) {
		if ( typeof selector === "string" ) {

			// ( types, selector, fn )
			fn = data;
			data = undefined;
		} else {

			// ( types, data, fn )
			fn = data;
			data = selector;
			selector = undefined;
		}
	}
	if ( fn === false ) {
		fn = returnFalse;
	} else if ( !fn ) {
		return elem;
	}

	if ( one === 1 ) {
		origFn = fn;
		fn = function( event ) {

			// Can use an empty set, since event contains the info
			jQuery().off( event );
			return origFn.apply( this, arguments );
		};

		// Use same guid so caller can remove using origFn
		fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
	}
	return elem.each( function() {
		jQuery.event.add( this, types, fn, data, selector );
	} );
}

/*
 * Helper functions for managing events -- not part of the public interface.
 * Props to Dean Edwards' addEvent library for many of the ideas.
 */
jQuery.event = {

	global: {},

	add: function( elem, types, handler, data, selector ) {

		var handleObjIn, eventHandle, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = dataPriv.get( elem );

		// Don't attach events to noData or text/comment nodes (but allow plain objects)
		if ( !elemData ) {
			return;
		}

		// Caller can pass in an object of custom data in lieu of the handler
		if ( handler.handler ) {
			handleObjIn = handler;
			handler = handleObjIn.handler;
			selector = handleObjIn.selector;
		}

		// Ensure that invalid selectors throw exceptions at attach time
		// Evaluate against documentElement in case elem is a non-element node (e.g., document)
		if ( selector ) {
			jQuery.find.matchesSelector( documentElement, selector );
		}

		// Make sure that the handler has a unique ID, used to find/remove it later
		if ( !handler.guid ) {
			handler.guid = jQuery.guid++;
		}

		// Init the element's event structure and main handler, if this is the first
		if ( !( events = elemData.events ) ) {
			events = elemData.events = {};
		}
		if ( !( eventHandle = elemData.handle ) ) {
			eventHandle = elemData.handle = function( e ) {

				// Discard the second event of a jQuery.event.trigger() and
				// when an event is called after a page has unloaded
				return typeof jQuery !== "undefined" && jQuery.event.triggered !== e.type ?
					jQuery.event.dispatch.apply( elem, arguments ) : undefined;
			};
		}

		// Handle multiple events separated by a space
		types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[ t ] ) || [];
			type = origType = tmp[ 1 ];
			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

			// There *must* be a type, no attaching namespace-only handlers
			if ( !type ) {
				continue;
			}

			// If event changes its type, use the special event handlers for the changed type
			special = jQuery.event.special[ type ] || {};

			// If selector defined, determine special event api type, otherwise given type
			type = ( selector ? special.delegateType : special.bindType ) || type;

			// Update special based on newly reset type
			special = jQuery.event.special[ type ] || {};

			// handleObj is passed to all event handlers
			handleObj = jQuery.extend( {
				type: type,
				origType: origType,
				data: data,
				handler: handler,
				guid: handler.guid,
				selector: selector,
				needsContext: selector && jQuery.expr.match.needsContext.test( selector ),
				namespace: namespaces.join( "." )
			}, handleObjIn );

			// Init the event handler queue if we're the first
			if ( !( handlers = events[ type ] ) ) {
				handlers = events[ type ] = [];
				handlers.delegateCount = 0;

				// Only use addEventListener if the special events handler returns false
				if ( !special.setup ||
					special.setup.call( elem, data, namespaces, eventHandle ) === false ) {

					if ( elem.addEventListener ) {
						elem.addEventListener( type, eventHandle );
					}
				}
			}

			if ( special.add ) {
				special.add.call( elem, handleObj );

				if ( !handleObj.handler.guid ) {
					handleObj.handler.guid = handler.guid;
				}
			}

			// Add to the element's handler list, delegates in front
			if ( selector ) {
				handlers.splice( handlers.delegateCount++, 0, handleObj );
			} else {
				handlers.push( handleObj );
			}

			// Keep track of which events have ever been used, for event optimization
			jQuery.event.global[ type ] = true;
		}

	},

	// Detach an event or set of events from an element
	remove: function( elem, types, handler, selector, mappedTypes ) {

		var j, origCount, tmp,
			events, t, handleObj,
			special, handlers, type, namespaces, origType,
			elemData = dataPriv.hasData( elem ) && dataPriv.get( elem );

		if ( !elemData || !( events = elemData.events ) ) {
			return;
		}

		// Once for each type.namespace in types; type may be omitted
		types = ( types || "" ).match( rnothtmlwhite ) || [ "" ];
		t = types.length;
		while ( t-- ) {
			tmp = rtypenamespace.exec( types[ t ] ) || [];
			type = origType = tmp[ 1 ];
			namespaces = ( tmp[ 2 ] || "" ).split( "." ).sort();

			// Unbind all events (on this namespace, if provided) for the element
			if ( !type ) {
				for ( type in events ) {
					jQuery.event.remove( elem, type + types[ t ], handler, selector, true );
				}
				continue;
			}

			special = jQuery.event.special[ type ] || {};
			type = ( selector ? special.delegateType : special.bindType ) || type;
			handlers = events[ type ] || [];
			tmp = tmp[ 2 ] &&
				new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" );

			// Remove matching events
			origCount = j = handlers.length;
			while ( j-- ) {
				handleObj = handlers[ j ];

				if ( ( mappedTypes || origType === handleObj.origType ) &&
					( !handler || handler.guid === handleObj.guid ) &&
					( !tmp || tmp.test( handleObj.namespace ) ) &&
					( !selector || selector === handleObj.selector ||
						selector === "**" && handleObj.selector ) ) {
					handlers.splice( j, 1 );

					if ( handleObj.selector ) {
						handlers.delegateCount--;
					}
					if ( special.remove ) {
						special.remove.call( elem, handleObj );
					}
				}
			}

			// Remove generic event handler if we removed something and no more handlers exist
			// (avoids potential for endless recursion during removal of special event handlers)
			if ( origCount && !handlers.length ) {
				if ( !special.teardown ||
					special.teardown.call( elem, namespaces, elemData.handle ) === false ) {

					jQuery.removeEvent( elem, type, elemData.handle );
				}

				delete events[ type ];
			}
		}

		// Remove data and the expando if it's no longer used
		if ( jQuery.isEmptyObject( events ) ) {
			dataPriv.remove( elem, "handle events" );
		}
	},

	dispatch: function( nativeEvent ) {

		// Make a writable jQuery.Event from the native event object
		var event = jQuery.event.fix( nativeEvent );

		var i, j, ret, matched, handleObj, handlerQueue,
			args = new Array( arguments.length ),
			handlers = ( dataPriv.get( this, "events" ) || {} )[ event.type ] || [],
			special = jQuery.event.special[ event.type ] || {};

		// Use the fix-ed jQuery.Event rather than the (read-only) native event
		args[ 0 ] = event;

		for ( i = 1; i < arguments.length; i++ ) {
			args[ i ] = arguments[ i ];
		}

		event.delegateTarget = this;

		// Call the preDispatch hook for the mapped type, and let it bail if desired
		if ( special.preDispatch && special.preDispatch.call( this, event ) === false ) {
			return;
		}

		// Determine handlers
		handlerQueue = jQuery.event.handlers.call( this, event, handlers );

		// Run delegates first; they may want to stop propagation beneath us
		i = 0;
		while ( ( matched = handlerQueue[ i++ ] ) && !event.isPropagationStopped() ) {
			event.currentTarget = matched.elem;

			j = 0;
			while ( ( handleObj = matched.handlers[ j++ ] ) &&
				!event.isImmediatePropagationStopped() ) {

				// If the event is namespaced, then each handler is only invoked if it is
				// specially universal or its namespaces are a superset of the event's.
				if ( !event.rnamespace || handleObj.namespace === false ||
					event.rnamespace.test( handleObj.namespace ) ) {

					event.handleObj = handleObj;
					event.data = handleObj.data;

					ret = ( ( jQuery.event.special[ handleObj.origType ] || {} ).handle ||
						handleObj.handler ).apply( matched.elem, args );

					if ( ret !== undefined ) {
						if ( ( event.result = ret ) === false ) {
							event.preventDefault();
							event.stopPropagation();
						}
					}
				}
			}
		}

		// Call the postDispatch hook for the mapped type
		if ( special.postDispatch ) {
			special.postDispatch.call( this, event );
		}

		return event.result;
	},

	handlers: function( event, handlers ) {
		var i, handleObj, sel, matchedHandlers, matchedSelectors,
			handlerQueue = [],
			delegateCount = handlers.delegateCount,
			cur = event.target;

		// Find delegate handlers
		if ( delegateCount &&

			// Support: IE <=9
			// Black-hole SVG <use> instance trees (trac-13180)
			cur.nodeType &&

			// Support: Firefox <=42
			// Suppress spec-violating clicks indicating a non-primary pointer button (trac-3861)
			// https://www.w3.org/TR/DOM-Level-3-Events/#event-type-click
			// Support: IE 11 only
			// ...but not arrow key "clicks" of radio inputs, which can have `button` -1 (gh-2343)
			!( event.type === "click" && event.button >= 1 ) ) {

			for ( ; cur !== this; cur = cur.parentNode || this ) {

				// Don't check non-elements (#13208)
				// Don't process clicks on disabled elements (#6911, #8165, #11382, #11764)
				if ( cur.nodeType === 1 && !( event.type === "click" && cur.disabled === true ) ) {
					matchedHandlers = [];
					matchedSelectors = {};
					for ( i = 0; i < delegateCount; i++ ) {
						handleObj = handlers[ i ];

						// Don't conflict with Object.prototype properties (#13203)
						sel = handleObj.selector + " ";

						if ( matchedSelectors[ sel ] === undefined ) {
							matchedSelectors[ sel ] = handleObj.needsContext ?
								jQuery( sel, this ).index( cur ) > -1 :
								jQuery.find( sel, this, null, [ cur ] ).length;
						}
						if ( matchedSelectors[ sel ] ) {
							matchedHandlers.push( handleObj );
						}
					}
					if ( matchedHandlers.length ) {
						handlerQueue.push( { elem: cur, handlers: matchedHandlers } );
					}
				}
			}
		}

		// Add the remaining (directly-bound) handlers
		cur = this;
		if ( delegateCount < handlers.length ) {
			handlerQueue.push( { elem: cur, handlers: handlers.slice( delegateCount ) } );
		}

		return handlerQueue;
	},

	addProp: function( name, hook ) {
		Object.defineProperty( jQuery.Event.prototype, name, {
			enumerable: true,
			configurable: true,

			get: isFunction( hook ) ?
				function() {
					if ( this.originalEvent ) {
							return hook( this.originalEvent );
					}
				} :
				function() {
					if ( this.originalEvent ) {
							return this.originalEvent[ name ];
					}
				},

			set: function( value ) {
				Object.defineProperty( this, name, {
					enumerable: true,
					configurable: true,
					writable: true,
					value: value
				} );
			}
		} );
	},

	fix: function( originalEvent ) {
		return originalEvent[ jQuery.expando ] ?
			originalEvent :
			new jQuery.Event( originalEvent );
	},

	special: {
		load: {

			// Prevent triggered image.load events from bubbling to window.load
			noBubble: true
		},
		click: {

			// Utilize native event to ensure correct state for checkable inputs
			setup: function( data ) {

				// For mutual compressibility with _default, replace `this` access with a local var.
				// `|| data` is dead code meant only to preserve the variable through minification.
				var el = this || data;

				// Claim the first handler
				if ( rcheckableType.test( el.type ) &&
					el.click && nodeName( el, "input" ) ) {

					// dataPriv.set( el, "click", ... )
					leverageNative( el, "click", returnTrue );
				}

				// Return false to allow normal processing in the caller
				return false;
			},
			trigger: function( data ) {

				// For mutual compressibility with _default, replace `this` access with a local var.
				// `|| data` is dead code meant only to preserve the variable through minification.
				var el = this || data;

				// Force setup before triggering a click
				if ( rcheckableType.test( el.type ) &&
					el.click && nodeName( el, "input" ) ) {

					leverageNative( el, "click" );
				}

				// Return non-false to allow normal event-path propagation
				return true;
			},

			// For cross-browser consistency, suppress native .click() on links
			// Also prevent it if we're currently inside a leveraged native-event stack
			_default: function( event ) {
				var target = event.target;
				return rcheckableType.test( target.type ) &&
					target.click && nodeName( target, "input" ) &&
					dataPriv.get( target, "click" ) ||
					nodeName( target, "a" );
			}
		},

		beforeunload: {
			postDispatch: function( event ) {

				// Support: Firefox 20+
				// Firefox doesn't alert if the returnValue field is not set.
				if ( event.result !== undefined && event.originalEvent ) {
					event.originalEvent.returnValue = event.result;
				}
			}
		}
	}
};

// Ensure the presence of an event listener that handles manually-triggered
// synthetic events by interrupting progress until reinvoked in response to
// *native* events that it fires directly, ensuring that state changes have
// already occurred before other listeners are invoked.
function leverageNative( el, type, expectSync ) {

	// Missing expectSync indicates a trigger call, which must force setup through jQuery.event.add
	if ( !expectSync ) {
		if ( dataPriv.get( el, type ) === undefined ) {
			jQuery.event.add( el, type, returnTrue );
		}
		return;
	}

	// Register the controller as a special universal handler for all event namespaces
	dataPriv.set( el, type, false );
	jQuery.event.add( el, type, {
		namespace: false,
		handler: function( event ) {
			var notAsync, result,
				saved = dataPriv.get( this, type );

			if ( ( event.isTrigger & 1 ) && this[ type ] ) {

				// Interrupt processing of the outer synthetic .trigger()ed event
				// Saved data should be false in such cases, but might be a leftover capture object
				// from an async native handler (gh-4350)
				if ( !saved.length ) {

					// Store arguments for use when handling the inner native event
					// There will always be at least one argument (an event object), so this array
					// will not be confused with a leftover capture object.
					saved = slice.call( arguments );
					dataPriv.set( this, type, saved );

					// Trigger the native event and capture its result
					// Support: IE <=9 - 11+
					// focus() and blur() are asynchronous
					notAsync = expectSync( this, type );
					this[ type ]();
					result = dataPriv.get( this, type );
					if ( saved !== result || notAsync ) {
						dataPriv.set( this, type, false );
					} else {
						result = {};
					}
					if ( saved !== result ) {

						// Cancel the outer synthetic event
						event.stopImmediatePropagation();
						event.preventDefault();
						return result.value;
					}

				// If this is an inner synthetic event for an event with a bubbling surrogate
				// (focus or blur), assume that the surrogate already propagated from triggering the
				// native event and prevent that from happening again here.
				// This technically gets the ordering wrong w.r.t. to `.trigger()` (in which the
				// bubbling surrogate propagates *after* the non-bubbling base), but that seems
				// less bad than duplication.
				} else if ( ( jQuery.event.special[ type ] || {} ).delegateType ) {
					event.stopPropagation();
				}

			// If this is a native event triggered above, everything is now in order
			// Fire an inner synthetic event with the original arguments
			} else if ( saved.length ) {

				// ...and capture the result
				dataPriv.set( this, type, {
					value: jQuery.event.trigger(

						// Support: IE <=9 - 11+
						// Extend with the prototype to reset the above stopImmediatePropagation()
						jQuery.extend( saved[ 0 ], jQuery.Event.prototype ),
						saved.slice( 1 ),
						this
					)
				} );

				// Abort handling of the native event
				event.stopImmediatePropagation();
			}
		}
	} );
}

jQuery.removeEvent = function( elem, type, handle ) {

	// This "if" is needed for plain objects
	if ( elem.removeEventListener ) {
		elem.removeEventListener( type, handle );
	}
};

jQuery.Event = function( src, props ) {

	// Allow instantiation without the 'new' keyword
	if ( !( this instanceof jQuery.Event ) ) {
		return new jQuery.Event( src, props );
	}

	// Event object
	if ( src && src.type ) {
		this.originalEvent = src;
		this.type = src.type;

		// Events bubbling up the document may have been marked as prevented
		// by a handler lower down the tree; reflect the correct value.
		this.isDefaultPrevented = src.defaultPrevented ||
				src.defaultPrevented === undefined &&

				// Support: Android <=2.3 only
				src.returnValue === false ?
			returnTrue :
			returnFalse;

		// Create target properties
		// Support: Safari <=6 - 7 only
		// Target should not be a text node (#504, #13143)
		this.target = ( src.target && src.target.nodeType === 3 ) ?
			src.target.parentNode :
			src.target;

		this.currentTarget = src.currentTarget;
		this.relatedTarget = src.relatedTarget;

	// Event type
	} else {
		this.type = src;
	}

	// Put explicitly provided properties onto the event object
	if ( props ) {
		jQuery.extend( this, props );
	}

	// Create a timestamp if incoming event doesn't have one
	this.timeStamp = src && src.timeStamp || Date.now();

	// Mark it as fixed
	this[ jQuery.expando ] = true;
};

// jQuery.Event is based on DOM3 Events as specified by the ECMAScript Language Binding
// https://www.w3.org/TR/2003/WD-DOM-Level-3-Events-20030331/ecma-script-binding.html
jQuery.Event.prototype = {
	constructor: jQuery.Event,
	isDefaultPrevented: returnFalse,
	isPropagationStopped: returnFalse,
	isImmediatePropagationStopped: returnFalse,
	isSimulated: false,

	preventDefault: function() {
		var e = this.originalEvent;

		this.isDefaultPrevented = returnTrue;

		if ( e && !this.isSimulated ) {
			e.preventDefault();
		}
	},
	stopPropagation: function() {
		var e = this.originalEvent;

		this.isPropagationStopped = returnTrue;

		if ( e && !this.isSimulated ) {
			e.stopPropagation();
		}
	},
	stopImmediatePropagation: function() {
		var e = this.originalEvent;

		this.isImmediatePropagationStopped = returnTrue;

		if ( e && !this.isSimulated ) {
			e.stopImmediatePropagation();
		}

		this.stopPropagation();
	}
};

// Includes all common event props including KeyEvent and MouseEvent specific props
jQuery.each( {
	altKey: true,
	bubbles: true,
	cancelable: true,
	changedTouches: true,
	ctrlKey: true,
	detail: true,
	eventPhase: true,
	metaKey: true,
	pageX: true,
	pageY: true,
	shiftKey: true,
	view: true,
	"char": true,
	code: true,
	charCode: true,
	key: true,
	keyCode: true,
	button: true,
	buttons: true,
	clientX: true,
	clientY: true,
	offsetX: true,
	offsetY: true,
	pointerId: true,
	pointerType: true,
	screenX: true,
	screenY: true,
	targetTouches: true,
	toElement: true,
	touches: true,

	which: function( event ) {
		var button = event.button;

		// Add which for key events
		if ( event.which == null && rkeyEvent.test( event.type ) ) {
			return event.charCode != null ? event.charCode : event.keyCode;
		}

		// Add which for click: 1 === left; 2 === middle; 3 === right
		if ( !event.which && button !== undefined && rmouseEvent.test( event.type ) ) {
			if ( button & 1 ) {
				return 1;
			}

			if ( button & 2 ) {
				return 3;
			}

			if ( button & 4 ) {
				return 2;
			}

			return 0;
		}

		return event.which;
	}
}, jQuery.event.addProp );

jQuery.each( { focus: "focusin", blur: "focusout" }, function( type, delegateType ) {
	jQuery.event.special[ type ] = {

		// Utilize native event if possible so blur/focus sequence is correct
		setup: function() {

			// Claim the first handler
			// dataPriv.set( this, "focus", ... )
			// dataPriv.set( this, "blur", ... )
			leverageNative( this, type, expectSync );

			// Return false to allow normal processing in the caller
			return false;
		},
		trigger: function() {

			// Force setup before trigger
			leverageNative( this, type );

			// Return non-false to allow normal event-path propagation
			return true;
		},

		delegateType: delegateType
	};
} );

// Create mouseenter/leave events using mouseover/out and event-time checks
// so that event delegation works in jQuery.
// Do the same for pointerenter/pointerleave and pointerover/pointerout
//
// Support: Safari 7 only
// Safari sends mouseenter too often; see:
// https://bugs.chromium.org/p/chromium/issues/detail?id=470258
// for the description of the bug (it existed in older Chrome versions as well).
jQuery.each( {
	mouseenter: "mouseover",
	mouseleave: "mouseout",
	pointerenter: "pointerover",
	pointerleave: "pointerout"
}, function( orig, fix ) {
	jQuery.event.special[ orig ] = {
		delegateType: fix,
		bindType: fix,

		handle: function( event ) {
			var ret,
				target = this,
				related = event.relatedTarget,
				handleObj = event.handleObj;

			// For mouseenter/leave call the handler if related is outside the target.
			// NB: No relatedTarget if the mouse left/entered the browser window
			if ( !related || ( related !== target && !jQuery.contains( target, related ) ) ) {
				event.type = handleObj.origType;
				ret = handleObj.handler.apply( this, arguments );
				event.type = fix;
			}
			return ret;
		}
	};
} );

jQuery.fn.extend( {

	on: function( types, selector, data, fn ) {
		return on( this, types, selector, data, fn );
	},
	one: function( types, selector, data, fn ) {
		return on( this, types, selector, data, fn, 1 );
	},
	off: function( types, selector, fn ) {
		var handleObj, type;
		if ( types && types.preventDefault && types.handleObj ) {

			// ( event )  dispatched jQuery.Event
			handleObj = types.handleObj;
			jQuery( types.delegateTarget ).off(
				handleObj.namespace ?
					handleObj.origType + "." + handleObj.namespace :
					handleObj.origType,
				handleObj.selector,
				handleObj.handler
			);
			return this;
		}
		if ( typeof types === "object" ) {

			// ( types-object [, selector] )
			for ( type in types ) {
				this.off( type, selector, types[ type ] );
			}
			return this;
		}
		if ( selector === false || typeof selector === "function" ) {

			// ( types [, fn] )
			fn = selector;
			selector = undefined;
		}
		if ( fn === false ) {
			fn = returnFalse;
		}
		return this.each( function() {
			jQuery.event.remove( this, types, fn, selector );
		} );
	}
} );


var

	/* eslint-disable max-len */

	// See https://github.com/eslint/eslint/issues/3229
	rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([a-z][^\/\0>\x20\t\r\n\f]*)[^>]*)\/>/gi,

	/* eslint-enable */

	// Support: IE <=10 - 11, Edge 12 - 13 only
	// In IE/Edge using regex groups here causes severe slowdowns.
	// See https://connect.microsoft.com/IE/feedback/details/1736512/
	rnoInnerhtml = /<script|<style|<link/i,

	// checked="checked" or checked
	rchecked = /checked\s*(?:[^=]|=\s*.checked.)/i,
	rcleanScript = /^\s*<!(?:\[CDATA\[|--)|(?:\]\]|--)>\s*$/g;

// Prefer a tbody over its parent table for containing new rows
function manipulationTarget( elem, content ) {
	if ( nodeName( elem, "table" ) &&
		nodeName( content.nodeType !== 11 ? content : content.firstChild, "tr" ) ) {

		return jQuery( elem ).children( "tbody" )[ 0 ] || elem;
	}

	return elem;
}

// Replace/restore the type attribute of script elements for safe DOM manipulation
function disableScript( elem ) {
	elem.type = ( elem.getAttribute( "type" ) !== null ) + "/" + elem.type;
	return elem;
}
function restoreScript( elem ) {
	if ( ( elem.type || "" ).slice( 0, 5 ) === "true/" ) {
		elem.type = elem.type.slice( 5 );
	} else {
		elem.removeAttribute( "type" );
	}

	return elem;
}

function cloneCopyEvent( src, dest ) {
	var i, l, type, pdataOld, pdataCur, udataOld, udataCur, events;

	if ( dest.nodeType !== 1 ) {
		return;
	}

	// 1. Copy private data: events, handlers, etc.
	if ( dataPriv.hasData( src ) ) {
		pdataOld = dataPriv.access( src );
		pdataCur = dataPriv.set( dest, pdataOld );
		events = pdataOld.events;

		if ( events ) {
			delete pdataCur.handle;
			pdataCur.events = {};

			for ( type in events ) {
				for ( i = 0, l = events[ type ].length; i < l; i++ ) {
					jQuery.event.add( dest, type, events[ type ][ i ] );
				}
			}
		}
	}

	// 2. Copy user data
	if ( dataUser.hasData( src ) ) {
		udataOld = dataUser.access( src );
		udataCur = jQuery.extend( {}, udataOld );

		dataUser.set( dest, udataCur );
	}
}

// Fix IE bugs, see support tests
function fixInput( src, dest ) {
	var nodeName = dest.nodeName.toLowerCase();

	// Fails to persist the checked state of a cloned checkbox or radio button.
	if ( nodeName === "input" && rcheckableType.test( src.type ) ) {
		dest.checked = src.checked;

	// Fails to return the selected option to the default selected state when cloning options
	} else if ( nodeName === "input" || nodeName === "textarea" ) {
		dest.defaultValue = src.defaultValue;
	}
}

function domManip( collection, args, callback, ignored ) {

	// Flatten any nested arrays
	args = concat.apply( [], args );

	var fragment, first, scripts, hasScripts, node, doc,
		i = 0,
		l = collection.length,
		iNoClone = l - 1,
		value = args[ 0 ],
		valueIsFunction = isFunction( value );

	// We can't cloneNode fragments that contain checked, in WebKit
	if ( valueIsFunction ||
			( l > 1 && typeof value === "string" &&
				!support.checkClone && rchecked.test( value ) ) ) {
		return collection.each( function( index ) {
			var self = collection.eq( index );
			if ( valueIsFunction ) {
				args[ 0 ] = value.call( this, index, self.html() );
			}
			domManip( self, args, callback, ignored );
		} );
	}

	if ( l ) {
		fragment = buildFragment( args, collection[ 0 ].ownerDocument, false, collection, ignored );
		first = fragment.firstChild;

		if ( fragment.childNodes.length === 1 ) {
			fragment = first;
		}

		// Require either new content or an interest in ignored elements to invoke the callback
		if ( first || ignored ) {
			scripts = jQuery.map( getAll( fragment, "script" ), disableScript );
			hasScripts = scripts.length;

			// Use the original fragment for the last item
			// instead of the first because it can end up
			// being emptied incorrectly in certain situations (#8070).
			for ( ; i < l; i++ ) {
				node = fragment;

				if ( i !== iNoClone ) {
					node = jQuery.clone( node, true, true );

					// Keep references to cloned scripts for later restoration
					if ( hasScripts ) {

						// Support: Android <=4.0 only, PhantomJS 1 only
						// push.apply(_, arraylike) throws on ancient WebKit
						jQuery.merge( scripts, getAll( node, "script" ) );
					}
				}

				callback.call( collection[ i ], node, i );
			}

			if ( hasScripts ) {
				doc = scripts[ scripts.length - 1 ].ownerDocument;

				// Reenable scripts
				jQuery.map( scripts, restoreScript );

				// Evaluate executable scripts on first document insertion
				for ( i = 0; i < hasScripts; i++ ) {
					node = scripts[ i ];
					if ( rscriptType.test( node.type || "" ) &&
						!dataPriv.access( node, "globalEval" ) &&
						jQuery.contains( doc, node ) ) {

						if ( node.src && ( node.type || "" ).toLowerCase()  !== "module" ) {

							// Optional AJAX dependency, but won't run scripts if not present
							if ( jQuery._evalUrl && !node.noModule ) {
								jQuery._evalUrl( node.src, {
									nonce: node.nonce || node.getAttribute( "nonce" )
								} );
							}
						} else {
							DOMEval( node.textContent.replace( rcleanScript, "" ), node, doc );
						}
					}
				}
			}
		}
	}

	return collection;
}

function remove( elem, selector, keepData ) {
	var node,
		nodes = selector ? jQuery.filter( selector, elem ) : elem,
		i = 0;

	for ( ; ( node = nodes[ i ] ) != null; i++ ) {
		if ( !keepData && node.nodeType === 1 ) {
			jQuery.cleanData( getAll( node ) );
		}

		if ( node.parentNode ) {
			if ( keepData && isAttached( node ) ) {
				setGlobalEval( getAll( node, "script" ) );
			}
			node.parentNode.removeChild( node );
		}
	}

	return elem;
}

jQuery.extend( {
	htmlPrefilter: function( html ) {
		return html.replace( rxhtmlTag, "<$1></$2>" );
	},

	clone: function( elem, dataAndEvents, deepDataAndEvents ) {
		var i, l, srcElements, destElements,
			clone = elem.cloneNode( true ),
			inPage = isAttached( elem );

		// Fix IE cloning issues
		if ( !support.noCloneChecked && ( elem.nodeType === 1 || elem.nodeType === 11 ) &&
				!jQuery.isXMLDoc( elem ) ) {

			// We eschew Sizzle here for performance reasons: https://jsperf.com/getall-vs-sizzle/2
			destElements = getAll( clone );
			srcElements = getAll( elem );

			for ( i = 0, l = srcElements.length; i < l; i++ ) {
				fixInput( srcElements[ i ], destElements[ i ] );
			}
		}

		// Copy the events from the original to the clone
		if ( dataAndEvents ) {
			if ( deepDataAndEvents ) {
				srcElements = srcElements || getAll( elem );
				destElements = destElements || getAll( clone );

				for ( i = 0, l = srcElements.length; i < l; i++ ) {
					cloneCopyEvent( srcElements[ i ], destElements[ i ] );
				}
			} else {
				cloneCopyEvent( elem, clone );
			}
		}

		// Preserve script evaluation history
		destElements = getAll( clone, "script" );
		if ( destElements.length > 0 ) {
			setGlobalEval( destElements, !inPage && getAll( elem, "script" ) );
		}

		// Return the cloned set
		return clone;
	},

	cleanData: function( elems ) {
		var data, elem, type,
			special = jQuery.event.special,
			i = 0;

		for ( ; ( elem = elems[ i ] ) !== undefined; i++ ) {
			if ( acceptData( elem ) ) {
				if ( ( data = elem[ dataPriv.expando ] ) ) {
					if ( data.events ) {
						for ( type in data.events ) {
							if ( special[ type ] ) {
								jQuery.event.remove( elem, type );

							// This is a shortcut to avoid jQuery.event.remove's overhead
							} else {
								jQuery.removeEvent( elem, type, data.handle );
							}
						}
					}

					// Support: Chrome <=35 - 45+
					// Assign undefined instead of using delete, see Data#remove
					elem[ dataPriv.expando ] = undefined;
				}
				if ( elem[ dataUser.expando ] ) {

					// Support: Chrome <=35 - 45+
					// Assign undefined instead of using delete, see Data#remove
					elem[ dataUser.expando ] = undefined;
				}
			}
		}
	}
} );

jQuery.fn.extend( {
	detach: function( selector ) {
		return remove( this, selector, true );
	},

	remove: function( selector ) {
		return remove( this, selector );
	},

	text: function( value ) {
		return access( this, function( value ) {
			return value === undefined ?
				jQuery.text( this ) :
				this.empty().each( function() {
					if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
						this.textContent = value;
					}
				} );
		}, null, value, arguments.length );
	},

	append: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.appendChild( elem );
			}
		} );
	},

	prepend: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.nodeType === 1 || this.nodeType === 11 || this.nodeType === 9 ) {
				var target = manipulationTarget( this, elem );
				target.insertBefore( elem, target.firstChild );
			}
		} );
	},

	before: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this );
			}
		} );
	},

	after: function() {
		return domManip( this, arguments, function( elem ) {
			if ( this.parentNode ) {
				this.parentNode.insertBefore( elem, this.nextSibling );
			}
		} );
	},

	empty: function() {
		var elem,
			i = 0;

		for ( ; ( elem = this[ i ] ) != null; i++ ) {
			if ( elem.nodeType === 1 ) {

				// Prevent memory leaks
				jQuery.cleanData( getAll( elem, false ) );

				// Remove any remaining nodes
				elem.textContent = "";
			}
		}

		return this;
	},

	clone: function( dataAndEvents, deepDataAndEvents ) {
		dataAndEvents = dataAndEvents == null ? false : dataAndEvents;
		deepDataAndEvents = deepDataAndEvents == null ? dataAndEvents : deepDataAndEvents;

		return this.map( function() {
			return jQuery.clone( this, dataAndEvents, deepDataAndEvents );
		} );
	},

	html: function( value ) {
		return access( this, function( value ) {
			var elem = this[ 0 ] || {},
				i = 0,
				l = this.length;

			if ( value === undefined && elem.nodeType === 1 ) {
				return elem.innerHTML;
			}

			// See if we can take a shortcut and just use innerHTML
			if ( typeof value === "string" && !rnoInnerhtml.test( value ) &&
				!wrapMap[ ( rtagName.exec( value ) || [ "", "" ] )[ 1 ].toLowerCase() ] ) {

				value = jQuery.htmlPrefilter( value );

				try {
					for ( ; i < l; i++ ) {
						elem = this[ i ] || {};

						// Remove element nodes and prevent memory leaks
						if ( elem.nodeType === 1 ) {
							jQuery.cleanData( getAll( elem, false ) );
							elem.innerHTML = value;
						}
					}

					elem = 0;

				// If using innerHTML throws an exception, use the fallback method
				} catch ( e ) {}
			}

			if ( elem ) {
				this.empty().append( value );
			}
		}, null, value, arguments.length );
	},

	replaceWith: function() {
		var ignored = [];

		// Make the changes, replacing each non-ignored context element with the new content
		return domManip( this, arguments, function( elem ) {
			var parent = this.parentNode;

			if ( jQuery.inArray( this, ignored ) < 0 ) {
				jQuery.cleanData( getAll( this ) );
				if ( parent ) {
					parent.replaceChild( elem, this );
				}
			}

		// Force callback invocation
		}, ignored );
	}
} );

jQuery.each( {
	appendTo: "append",
	prependTo: "prepend",
	insertBefore: "before",
	insertAfter: "after",
	replaceAll: "replaceWith"
}, function( name, original ) {
	jQuery.fn[ name ] = function( selector ) {
		var elems,
			ret = [],
			insert = jQuery( selector ),
			last = insert.length - 1,
			i = 0;

		for ( ; i <= last; i++ ) {
			elems = i === last ? this : this.clone( true );
			jQuery( insert[ i ] )[ original ]( elems );

			// Support: Android <=4.0 only, PhantomJS 1 only
			// .get() because push.apply(_, arraylike) throws on ancient WebKit
			push.apply( ret, elems.get() );
		}

		return this.pushStack( ret );
	};
} );
var rnumnonpx = new RegExp( "^(" + pnum + ")(?!px)[a-z%]+$", "i" );

var getStyles = function( elem ) {

		// Support: IE <=11 only, Firefox <=30 (#15098, #14150)
		// IE throws on elements created in popups
		// FF meanwhile throws on frame elements through "defaultView.getComputedStyle"
		var view = elem.ownerDocument.defaultView;

		if ( !view || !view.opener ) {
			view = window;
		}

		return view.getComputedStyle( elem );
	};

var rboxStyle = new RegExp( cssExpand.join( "|" ), "i" );



( function() {

	// Executing both pixelPosition & boxSizingReliable tests require only one layout
	// so they're executed at the same time to save the second computation.
	function computeStyleTests() {

		// This is a singleton, we need to execute it only once
		if ( !div ) {
			return;
		}

		container.style.cssText = "position:absolute;left:-11111px;width:60px;" +
			"margin-top:1px;padding:0;border:0";
		div.style.cssText =
			"position:relative;display:block;box-sizing:border-box;overflow:scroll;" +
			"margin:auto;border:1px;padding:1px;" +
			"width:60%;top:1%";
		documentElement.appendChild( container ).appendChild( div );

		var divStyle = window.getComputedStyle( div );
		pixelPositionVal = divStyle.top !== "1%";

		// Support: Android 4.0 - 4.3 only, Firefox <=3 - 44
		reliableMarginLeftVal = roundPixelMeasures( divStyle.marginLeft ) === 12;

		// Support: Android 4.0 - 4.3 only, Safari <=9.1 - 10.1, iOS <=7.0 - 9.3
		// Some styles come back with percentage values, even though they shouldn't
		div.style.right = "60%";
		pixelBoxStylesVal = roundPixelMeasures( divStyle.right ) === 36;

		// Support: IE 9 - 11 only
		// Detect misreporting of content dimensions for box-sizing:border-box elements
		boxSizingReliableVal = roundPixelMeasures( divStyle.width ) === 36;

		// Support: IE 9 only
		// Detect overflow:scroll screwiness (gh-3699)
		// Support: Chrome <=64
		// Don't get tricked when zoom affects offsetWidth (gh-4029)
		div.style.position = "absolute";
		scrollboxSizeVal = roundPixelMeasures( div.offsetWidth / 3 ) === 12;

		documentElement.removeChild( container );

		// Nullify the div so it wouldn't be stored in the memory and
		// it will also be a sign that checks already performed
		div = null;
	}

	function roundPixelMeasures( measure ) {
		return Math.round( parseFloat( measure ) );
	}

	var pixelPositionVal, boxSizingReliableVal, scrollboxSizeVal, pixelBoxStylesVal,
		reliableMarginLeftVal,
		container = document.createElement( "div" ),
		div = document.createElement( "div" );

	// Finish early in limited (non-browser) environments
	if ( !div.style ) {
		return;
	}

	// Support: IE <=9 - 11 only
	// Style of cloned element affects source element cloned (#8908)
	div.style.backgroundClip = "content-box";
	div.cloneNode( true ).style.backgroundClip = "";
	support.clearCloneStyle = div.style.backgroundClip === "content-box";

	jQuery.extend( support, {
		boxSizingReliable: function() {
			computeStyleTests();
			return boxSizingReliableVal;
		},
		pixelBoxStyles: function() {
			computeStyleTests();
			return pixelBoxStylesVal;
		},
		pixelPosition: function() {
			computeStyleTests();
			return pixelPositionVal;
		},
		reliableMarginLeft: function() {
			computeStyleTests();
			return reliableMarginLeftVal;
		},
		scrollboxSize: function() {
			computeStyleTests();
			return scrollboxSizeVal;
		}
	} );
} )();


function curCSS( elem, name, computed ) {
	var width, minWidth, maxWidth, ret,

		// Support: Firefox 51+
		// Retrieving style before computed somehow
		// fixes an issue with getting wrong values
		// on detached elements
		style = elem.style;

	computed = computed || getStyles( elem );

	// getPropertyValue is needed for:
	//   .css('filter') (IE 9 only, #12537)
	//   .css('--customProperty) (#3144)
	if ( computed ) {
		ret = computed.getPropertyValue( name ) || computed[ name ];

		if ( ret === "" && !isAttached( elem ) ) {
			ret = jQuery.style( elem, name );
		}

		// A tribute to the "awesome hack by Dean Edwards"
		// Android Browser returns percentage for some values,
		// but width seems to be reliably pixels.
		// This is against the CSSOM draft spec:
		// https://drafts.csswg.org/cssom/#resolved-values
		if ( !support.pixelBoxStyles() && rnumnonpx.test( ret ) && rboxStyle.test( name ) ) {

			// Remember the original values
			width = style.width;
			minWidth = style.minWidth;
			maxWidth = style.maxWidth;

			// Put in the new values to get a computed value out
			style.minWidth = style.maxWidth = style.width = ret;
			ret = computed.width;

			// Revert the changed values
			style.width = width;
			style.minWidth = minWidth;
			style.maxWidth = maxWidth;
		}
	}

	return ret !== undefined ?

		// Support: IE <=9 - 11 only
		// IE returns zIndex value as an integer.
		ret + "" :
		ret;
}


function addGetHookIf( conditionFn, hookFn ) {

	// Define the hook, we'll check on the first run if it's really needed.
	return {
		get: function() {
			if ( conditionFn() ) {

				// Hook not needed (or it's not possible to use it due
				// to missing dependency), remove it.
				delete this.get;
				return;
			}

			// Hook needed; redefine it so that the support test is not executed again.
			return ( this.get = hookFn ).apply( this, arguments );
		}
	};
}


var cssPrefixes = [ "Webkit", "Moz", "ms" ],
	emptyStyle = document.createElement( "div" ).style,
	vendorProps = {};

// Return a vendor-prefixed property or undefined
function vendorPropName( name ) {

	// Check for vendor prefixed names
	var capName = name[ 0 ].toUpperCase() + name.slice( 1 ),
		i = cssPrefixes.length;

	while ( i-- ) {
		name = cssPrefixes[ i ] + capName;
		if ( name in emptyStyle ) {
			return name;
		}
	}
}

// Return a potentially-mapped jQuery.cssProps or vendor prefixed property
function finalPropName( name ) {
	var final = jQuery.cssProps[ name ] || vendorProps[ name ];

	if ( final ) {
		return final;
	}
	if ( name in emptyStyle ) {
		return name;
	}
	return vendorProps[ name ] = vendorPropName( name ) || name;
}


var

	// Swappable if display is none or starts with table
	// except "table", "table-cell", or "table-caption"
	// See here for display values: https://developer.mozilla.org/en-US/docs/CSS/display
	rdisplayswap = /^(none|table(?!-c[ea]).+)/,
	rcustomProp = /^--/,
	cssShow = { position: "absolute", visibility: "hidden", display: "block" },
	cssNormalTransform = {
		letterSpacing: "0",
		fontWeight: "400"
	};

function setPositiveNumber( elem, value, subtract ) {

	// Any relative (+/-) values have already been
	// normalized at this point
	var matches = rcssNum.exec( value );
	return matches ?

		// Guard against undefined "subtract", e.g., when used as in cssHooks
		Math.max( 0, matches[ 2 ] - ( subtract || 0 ) ) + ( matches[ 3 ] || "px" ) :
		value;
}

function boxModelAdjustment( elem, dimension, box, isBorderBox, styles, computedVal ) {
	var i = dimension === "width" ? 1 : 0,
		extra = 0,
		delta = 0;

	// Adjustment may not be necessary
	if ( box === ( isBorderBox ? "border" : "content" ) ) {
		return 0;
	}

	for ( ; i < 4; i += 2 ) {

		// Both box models exclude margin
		if ( box === "margin" ) {
			delta += jQuery.css( elem, box + cssExpand[ i ], true, styles );
		}

		// If we get here with a content-box, we're seeking "padding" or "border" or "margin"
		if ( !isBorderBox ) {

			// Add padding
			delta += jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );

			// For "border" or "margin", add border
			if ( box !== "padding" ) {
				delta += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );

			// But still keep track of it otherwise
			} else {
				extra += jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}

		// If we get here with a border-box (content + padding + border), we're seeking "content" or
		// "padding" or "margin"
		} else {

			// For "content", subtract padding
			if ( box === "content" ) {
				delta -= jQuery.css( elem, "padding" + cssExpand[ i ], true, styles );
			}

			// For "content" or "padding", subtract border
			if ( box !== "margin" ) {
				delta -= jQuery.css( elem, "border" + cssExpand[ i ] + "Width", true, styles );
			}
		}
	}

	// Account for positive content-box scroll gutter when requested by providing computedVal
	if ( !isBorderBox && computedVal >= 0 ) {

		// offsetWidth/offsetHeight is a rounded sum of content, padding, scroll gutter, and border
		// Assuming integer scroll gutter, subtract the rest and round down
		delta += Math.max( 0, Math.ceil(
			elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
			computedVal -
			delta -
			extra -
			0.5

		// If offsetWidth/offsetHeight is unknown, then we can't determine content-box scroll gutter
		// Use an explicit zero to avoid NaN (gh-3964)
		) ) || 0;
	}

	return delta;
}

function getWidthOrHeight( elem, dimension, extra ) {

	// Start with computed style
	var styles = getStyles( elem ),

		// To avoid forcing a reflow, only fetch boxSizing if we need it (gh-4322).
		// Fake content-box until we know it's needed to know the true value.
		boxSizingNeeded = !support.boxSizingReliable() || extra,
		isBorderBox = boxSizingNeeded &&
			jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
		valueIsBorderBox = isBorderBox,

		val = curCSS( elem, dimension, styles ),
		offsetProp = "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 );

	// Support: Firefox <=54
	// Return a confounding non-pixel value or feign ignorance, as appropriate.
	if ( rnumnonpx.test( val ) ) {
		if ( !extra ) {
			return val;
		}
		val = "auto";
	}


	// Fall back to offsetWidth/offsetHeight when value is "auto"
	// This happens for inline elements with no explicit setting (gh-3571)
	// Support: Android <=4.1 - 4.3 only
	// Also use offsetWidth/offsetHeight for misreported inline dimensions (gh-3602)
	// Support: IE 9-11 only
	// Also use offsetWidth/offsetHeight for when box sizing is unreliable
	// We use getClientRects() to check for hidden/disconnected.
	// In those cases, the computed value can be trusted to be border-box
	if ( ( !support.boxSizingReliable() && isBorderBox ||
		val === "auto" ||
		!parseFloat( val ) && jQuery.css( elem, "display", false, styles ) === "inline" ) &&
		elem.getClientRects().length ) {

		isBorderBox = jQuery.css( elem, "boxSizing", false, styles ) === "border-box";

		// Where available, offsetWidth/offsetHeight approximate border box dimensions.
		// Where not available (e.g., SVG), assume unreliable box-sizing and interpret the
		// retrieved value as a content box dimension.
		valueIsBorderBox = offsetProp in elem;
		if ( valueIsBorderBox ) {
			val = elem[ offsetProp ];
		}
	}

	// Normalize "" and auto
	val = parseFloat( val ) || 0;

	// Adjust for the element's box model
	return ( val +
		boxModelAdjustment(
			elem,
			dimension,
			extra || ( isBorderBox ? "border" : "content" ),
			valueIsBorderBox,
			styles,

			// Provide the current computed size to request scroll gutter calculation (gh-3589)
			val
		)
	) + "px";
}

jQuery.extend( {

	// Add in style property hooks for overriding the default
	// behavior of getting and setting a style property
	cssHooks: {
		opacity: {
			get: function( elem, computed ) {
				if ( computed ) {

					// We should always get a number back from opacity
					var ret = curCSS( elem, "opacity" );
					return ret === "" ? "1" : ret;
				}
			}
		}
	},

	// Don't automatically add "px" to these possibly-unitless properties
	cssNumber: {
		"animationIterationCount": true,
		"columnCount": true,
		"fillOpacity": true,
		"flexGrow": true,
		"flexShrink": true,
		"fontWeight": true,
		"gridArea": true,
		"gridColumn": true,
		"gridColumnEnd": true,
		"gridColumnStart": true,
		"gridRow": true,
		"gridRowEnd": true,
		"gridRowStart": true,
		"lineHeight": true,
		"opacity": true,
		"order": true,
		"orphans": true,
		"widows": true,
		"zIndex": true,
		"zoom": true
	},

	// Add in properties whose names you wish to fix before
	// setting or getting the value
	cssProps: {},

	// Get and set the style property on a DOM Node
	style: function( elem, name, value, extra ) {

		// Don't set styles on text and comment nodes
		if ( !elem || elem.nodeType === 3 || elem.nodeType === 8 || !elem.style ) {
			return;
		}

		// Make sure that we're working with the right name
		var ret, type, hooks,
			origName = camelCase( name ),
			isCustomProp = rcustomProp.test( name ),
			style = elem.style;

		// Make sure that we're working with the right name. We don't
		// want to query the value if it is a CSS custom property
		// since they are user-defined.
		if ( !isCustomProp ) {
			name = finalPropName( origName );
		}

		// Gets hook for the prefixed version, then unprefixed version
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// Check if we're setting a value
		if ( value !== undefined ) {
			type = typeof value;

			// Convert "+=" or "-=" to relative numbers (#7345)
			if ( type === "string" && ( ret = rcssNum.exec( value ) ) && ret[ 1 ] ) {
				value = adjustCSS( elem, name, ret );

				// Fixes bug #9237
				type = "number";
			}

			// Make sure that null and NaN values aren't set (#7116)
			if ( value == null || value !== value ) {
				return;
			}

			// If a number was passed in, add the unit (except for certain CSS properties)
			// The isCustomProp check can be removed in jQuery 4.0 when we only auto-append
			// "px" to a few hardcoded values.
			if ( type === "number" && !isCustomProp ) {
				value += ret && ret[ 3 ] || ( jQuery.cssNumber[ origName ] ? "" : "px" );
			}

			// background-* props affect original clone's values
			if ( !support.clearCloneStyle && value === "" && name.indexOf( "background" ) === 0 ) {
				style[ name ] = "inherit";
			}

			// If a hook was provided, use that value, otherwise just set the specified value
			if ( !hooks || !( "set" in hooks ) ||
				( value = hooks.set( elem, value, extra ) ) !== undefined ) {

				if ( isCustomProp ) {
					style.setProperty( name, value );
				} else {
					style[ name ] = value;
				}
			}

		} else {

			// If a hook was provided get the non-computed value from there
			if ( hooks && "get" in hooks &&
				( ret = hooks.get( elem, false, extra ) ) !== undefined ) {

				return ret;
			}

			// Otherwise just get the value from the style object
			return style[ name ];
		}
	},

	css: function( elem, name, extra, styles ) {
		var val, num, hooks,
			origName = camelCase( name ),
			isCustomProp = rcustomProp.test( name );

		// Make sure that we're working with the right name. We don't
		// want to modify the value if it is a CSS custom property
		// since they are user-defined.
		if ( !isCustomProp ) {
			name = finalPropName( origName );
		}

		// Try prefixed name followed by the unprefixed name
		hooks = jQuery.cssHooks[ name ] || jQuery.cssHooks[ origName ];

		// If a hook was provided get the computed value from there
		if ( hooks && "get" in hooks ) {
			val = hooks.get( elem, true, extra );
		}

		// Otherwise, if a way to get the computed value exists, use that
		if ( val === undefined ) {
			val = curCSS( elem, name, styles );
		}

		// Convert "normal" to computed value
		if ( val === "normal" && name in cssNormalTransform ) {
			val = cssNormalTransform[ name ];
		}

		// Make numeric if forced or a qualifier was provided and val looks numeric
		if ( extra === "" || extra ) {
			num = parseFloat( val );
			return extra === true || isFinite( num ) ? num || 0 : val;
		}

		return val;
	}
} );

jQuery.each( [ "height", "width" ], function( i, dimension ) {
	jQuery.cssHooks[ dimension ] = {
		get: function( elem, computed, extra ) {
			if ( computed ) {

				// Certain elements can have dimension info if we invisibly show them
				// but it must have a current display style that would benefit
				return rdisplayswap.test( jQuery.css( elem, "display" ) ) &&

					// Support: Safari 8+
					// Table columns in Safari have non-zero offsetWidth & zero
					// getBoundingClientRect().width unless display is changed.
					// Support: IE <=11 only
					// Running getBoundingClientRect on a disconnected node
					// in IE throws an error.
					( !elem.getClientRects().length || !elem.getBoundingClientRect().width ) ?
						swap( elem, cssShow, function() {
							return getWidthOrHeight( elem, dimension, extra );
						} ) :
						getWidthOrHeight( elem, dimension, extra );
			}
		},

		set: function( elem, value, extra ) {
			var matches,
				styles = getStyles( elem ),

				// Only read styles.position if the test has a chance to fail
				// to avoid forcing a reflow.
				scrollboxSizeBuggy = !support.scrollboxSize() &&
					styles.position === "absolute",

				// To avoid forcing a reflow, only fetch boxSizing if we need it (gh-3991)
				boxSizingNeeded = scrollboxSizeBuggy || extra,
				isBorderBox = boxSizingNeeded &&
					jQuery.css( elem, "boxSizing", false, styles ) === "border-box",
				subtract = extra ?
					boxModelAdjustment(
						elem,
						dimension,
						extra,
						isBorderBox,
						styles
					) :
					0;

			// Account for unreliable border-box dimensions by comparing offset* to computed and
			// faking a content-box to get border and padding (gh-3699)
			if ( isBorderBox && scrollboxSizeBuggy ) {
				subtract -= Math.ceil(
					elem[ "offset" + dimension[ 0 ].toUpperCase() + dimension.slice( 1 ) ] -
					parseFloat( styles[ dimension ] ) -
					boxModelAdjustment( elem, dimension, "border", false, styles ) -
					0.5
				);
			}

			// Convert to pixels if value adjustment is needed
			if ( subtract && ( matches = rcssNum.exec( value ) ) &&
				( matches[ 3 ] || "px" ) !== "px" ) {

				elem.style[ dimension ] = value;
				value = jQuery.css( elem, dimension );
			}

			return setPositiveNumber( elem, value, subtract );
		}
	};
} );

jQuery.cssHooks.marginLeft = addGetHookIf( support.reliableMarginLeft,
	function( elem, computed ) {
		if ( computed ) {
			return ( parseFloat( curCSS( elem, "marginLeft" ) ) ||
				elem.getBoundingClientRect().left -
					swap( elem, { marginLeft: 0 }, function() {
						return elem.getBoundingClientRect().left;
					} )
				) + "px";
		}
	}
);

// These hooks are used by animate to expand properties
jQuery.each( {
	margin: "",
	padding: "",
	border: "Width"
}, function( prefix, suffix ) {
	jQuery.cssHooks[ prefix + suffix ] = {
		expand: function( value ) {
			var i = 0,
				expanded = {},

				// Assumes a single number if not a string
				parts = typeof value === "string" ? value.split( " " ) : [ value ];

			for ( ; i < 4; i++ ) {
				expanded[ prefix + cssExpand[ i ] + suffix ] =
					parts[ i ] || parts[ i - 2 ] || parts[ 0 ];
			}

			return expanded;
		}
	};

	if ( prefix !== "margin" ) {
		jQuery.cssHooks[ prefix + suffix ].set = setPositiveNumber;
	}
} );

jQuery.fn.extend( {
	css: function( name, value ) {
		return access( this, function( elem, name, value ) {
			var styles, len,
				map = {},
				i = 0;

			if ( Array.isArray( name ) ) {
				styles = getStyles( elem );
				len = name.length;

				for ( ; i < len; i++ ) {
					map[ name[ i ] ] = jQuery.css( elem, name[ i ], false, styles );
				}

				return map;
			}

			return value !== undefined ?
				jQuery.style( elem, name, value ) :
				jQuery.css( elem, name );
		}, name, value, arguments.length > 1 );
	}
} );


function Tween( elem, options, prop, end, easing ) {
	return new Tween.prototype.init( elem, options, prop, end, easing );
}
jQuery.Tween = Tween;

Tween.prototype = {
	constructor: Tween,
	init: function( elem, options, prop, end, easing, unit ) {
		this.elem = elem;
		this.prop = prop;
		this.easing = easing || jQuery.easing._default;
		this.options = options;
		this.start = this.now = this.cur();
		this.end = end;
		this.unit = unit || ( jQuery.cssNumber[ prop ] ? "" : "px" );
	},
	cur: function() {
		var hooks = Tween.propHooks[ this.prop ];

		return hooks && hooks.get ?
			hooks.get( this ) :
			Tween.propHooks._default.get( this );
	},
	run: function( percent ) {
		var eased,
			hooks = Tween.propHooks[ this.prop ];

		if ( this.options.duration ) {
			this.pos = eased = jQuery.easing[ this.easing ](
				percent, this.options.duration * percent, 0, 1, this.options.duration
			);
		} else {
			this.pos = eased = percent;
		}
		this.now = ( this.end - this.start ) * eased + this.start;

		if ( this.options.step ) {
			this.options.step.call( this.elem, this.now, this );
		}

		if ( hooks && hooks.set ) {
			hooks.set( this );
		} else {
			Tween.propHooks._default.set( this );
		}
		return this;
	}
};

Tween.prototype.init.prototype = Tween.prototype;

Tween.propHooks = {
	_default: {
		get: function( tween ) {
			var result;

			// Use a property on the element directly when it is not a DOM element,
			// or when there is no matching style property that exists.
			if ( tween.elem.nodeType !== 1 ||
				tween.elem[ tween.prop ] != null && tween.elem.style[ tween.prop ] == null ) {
				return tween.elem[ tween.prop ];
			}

			// Passing an empty string as a 3rd parameter to .css will automatically
			// attempt a parseFloat and fallback to a string if the parse fails.
			// Simple values such as "10px" are parsed to Float;
			// complex values such as "rotate(1rad)" are returned as-is.
			result = jQuery.css( tween.elem, tween.prop, "" );

			// Empty strings, null, undefined and "auto" are converted to 0.
			return !result || result === "auto" ? 0 : result;
		},
		set: function( tween ) {

			// Use step hook for back compat.
			// Use cssHook if its there.
			// Use .style if available and use plain properties where available.
			if ( jQuery.fx.step[ tween.prop ] ) {
				jQuery.fx.step[ tween.prop ]( tween );
			} else if ( tween.elem.nodeType === 1 && (
					jQuery.cssHooks[ tween.prop ] ||
					tween.elem.style[ finalPropName( tween.prop ) ] != null ) ) {
				jQuery.style( tween.elem, tween.prop, tween.now + tween.unit );
			} else {
				tween.elem[ tween.prop ] = tween.now;
			}
		}
	}
};

// Support: IE <=9 only
// Panic based approach to setting things on disconnected nodes
Tween.propHooks.scrollTop = Tween.propHooks.scrollLeft = {
	set: function( tween ) {
		if ( tween.elem.nodeType && tween.elem.parentNode ) {
			tween.elem[ tween.prop ] = tween.now;
		}
	}
};

jQuery.easing = {
	linear: function( p ) {
		return p;
	},
	swing: function( p ) {
		return 0.5 - Math.cos( p * Math.PI ) / 2;
	},
	_default: "swing"
};

jQuery.fx = Tween.prototype.init;

// Back compat <1.8 extension point
jQuery.fx.step = {};




var
	fxNow, inProgress,
	rfxtypes = /^(?:toggle|show|hide)$/,
	rrun = /queueHooks$/;

function schedule() {
	if ( inProgress ) {
		if ( document.hidden === false && window.requestAnimationFrame ) {
			window.requestAnimationFrame( schedule );
		} else {
			window.setTimeout( schedule, jQuery.fx.interval );
		}

		jQuery.fx.tick();
	}
}

// Animations created synchronously will run synchronously
function createFxNow() {
	window.setTimeout( function() {
		fxNow = undefined;
	} );
	return ( fxNow = Date.now() );
}

// Generate parameters to create a standard animation
function genFx( type, includeWidth ) {
	var which,
		i = 0,
		attrs = { height: type };

	// If we include width, step value is 1 to do all cssExpand values,
	// otherwise step value is 2 to skip over Left and Right
	includeWidth = includeWidth ? 1 : 0;
	for ( ; i < 4; i += 2 - includeWidth ) {
		which = cssExpand[ i ];
		attrs[ "margin" + which ] = attrs[ "padding" + which ] = type;
	}

	if ( includeWidth ) {
		attrs.opacity = attrs.width = type;
	}

	return attrs;
}

function createTween( value, prop, animation ) {
	var tween,
		collection = ( Animation.tweeners[ prop ] || [] ).concat( Animation.tweeners[ "*" ] ),
		index = 0,
		length = collection.length;
	for ( ; index < length; index++ ) {
		if ( ( tween = collection[ index ].call( animation, prop, value ) ) ) {

			// We're done with this property
			return tween;
		}
	}
}

function defaultPrefilter( elem, props, opts ) {
	var prop, value, toggle, hooks, oldfire, propTween, restoreDisplay, display,
		isBox = "width" in props || "height" in props,
		anim = this,
		orig = {},
		style = elem.style,
		hidden = elem.nodeType && isHiddenWithinTree( elem ),
		dataShow = dataPriv.get( elem, "fxshow" );

	// Queue-skipping animations hijack the fx hooks
	if ( !opts.queue ) {
		hooks = jQuery._queueHooks( elem, "fx" );
		if ( hooks.unqueued == null ) {
			hooks.unqueued = 0;
			oldfire = hooks.empty.fire;
			hooks.empty.fire = function() {
				if ( !hooks.unqueued ) {
					oldfire();
				}
			};
		}
		hooks.unqueued++;

		anim.always( function() {

			// Ensure the complete handler is called before this completes
			anim.always( function() {
				hooks.unqueued--;
				if ( !jQuery.queue( elem, "fx" ).length ) {
					hooks.empty.fire();
				}
			} );
		} );
	}

	// Detect show/hide animations
	for ( prop in props ) {
		value = props[ prop ];
		if ( rfxtypes.test( value ) ) {
			delete props[ prop ];
			toggle = toggle || value === "toggle";
			if ( value === ( hidden ? "hide" : "show" ) ) {

				// Pretend to be hidden if this is a "show" and
				// there is still data from a stopped show/hide
				if ( value === "show" && dataShow && dataShow[ prop ] !== undefined ) {
					hidden = true;

				// Ignore all other no-op show/hide data
				} else {
					continue;
				}
			}
			orig[ prop ] = dataShow && dataShow[ prop ] || jQuery.style( elem, prop );
		}
	}

	// Bail out if this is a no-op like .hide().hide()
	propTween = !jQuery.isEmptyObject( props );
	if ( !propTween && jQuery.isEmptyObject( orig ) ) {
		return;
	}

	// Restrict "overflow" and "display" styles during box animations
	if ( isBox && elem.nodeType === 1 ) {

		// Support: IE <=9 - 11, Edge 12 - 15
		// Record all 3 overflow attributes because IE does not infer the shorthand
		// from identically-valued overflowX and overflowY and Edge just mirrors
		// the overflowX value there.
		opts.overflow = [ style.overflow, style.overflowX, style.overflowY ];

		// Identify a display type, preferring old show/hide data over the CSS cascade
		restoreDisplay = dataShow && dataShow.display;
		if ( restoreDisplay == null ) {
			restoreDisplay = dataPriv.get( elem, "display" );
		}
		display = jQuery.css( elem, "display" );
		if ( display === "none" ) {
			if ( restoreDisplay ) {
				display = restoreDisplay;
			} else {

				// Get nonempty value(s) by temporarily forcing visibility
				showHide( [ elem ], true );
				restoreDisplay = elem.style.display || restoreDisplay;
				display = jQuery.css( elem, "display" );
				showHide( [ elem ] );
			}
		}

		// Animate inline elements as inline-block
		if ( display === "inline" || display === "inline-block" && restoreDisplay != null ) {
			if ( jQuery.css( elem, "float" ) === "none" ) {

				// Restore the original display value at the end of pure show/hide animations
				if ( !propTween ) {
					anim.done( function() {
						style.display = restoreDisplay;
					} );
					if ( restoreDisplay == null ) {
						display = style.display;
						restoreDisplay = display === "none" ? "" : display;
					}
				}
				style.display = "inline-block";
			}
		}
	}

	if ( opts.overflow ) {
		style.overflow = "hidden";
		anim.always( function() {
			style.overflow = opts.overflow[ 0 ];
			style.overflowX = opts.overflow[ 1 ];
			style.overflowY = opts.overflow[ 2 ];
		} );
	}

	// Implement show/hide animations
	propTween = false;
	for ( prop in orig ) {

		// General show/hide setup for this element animation
		if ( !propTween ) {
			if ( dataShow ) {
				if ( "hidden" in dataShow ) {
					hidden = dataShow.hidden;
				}
			} else {
				dataShow = dataPriv.access( elem, "fxshow", { display: restoreDisplay } );
			}

			// Store hidden/visible for toggle so `.stop().toggle()` "reverses"
			if ( toggle ) {
				dataShow.hidden = !hidden;
			}

			// Show elements before animating them
			if ( hidden ) {
				showHide( [ elem ], true );
			}

			/* eslint-disable no-loop-func */

			anim.done( function() {

			/* eslint-enable no-loop-func */

				// The final step of a "hide" animation is actually hiding the element
				if ( !hidden ) {
					showHide( [ elem ] );
				}
				dataPriv.remove( elem, "fxshow" );
				for ( prop in orig ) {
					jQuery.style( elem, prop, orig[ prop ] );
				}
			} );
		}

		// Per-property setup
		propTween = createTween( hidden ? dataShow[ prop ] : 0, prop, anim );
		if ( !( prop in dataShow ) ) {
			dataShow[ prop ] = propTween.start;
			if ( hidden ) {
				propTween.end = propTween.start;
				propTween.start = 0;
			}
		}
	}
}

function propFilter( props, specialEasing ) {
	var index, name, easing, value, hooks;

	// camelCase, specialEasing and expand cssHook pass
	for ( index in props ) {
		name = camelCase( index );
		easing = specialEasing[ name ];
		value = props[ index ];
		if ( Array.isArray( value ) ) {
			easing = value[ 1 ];
			value = props[ index ] = value[ 0 ];
		}

		if ( index !== name ) {
			props[ name ] = value;
			delete props[ index ];
		}

		hooks = jQuery.cssHooks[ name ];
		if ( hooks && "expand" in hooks ) {
			value = hooks.expand( value );
			delete props[ name ];

			// Not quite $.extend, this won't overwrite existing keys.
			// Reusing 'index' because we have the correct "name"
			for ( index in value ) {
				if ( !( index in props ) ) {
					props[ index ] = value[ index ];
					specialEasing[ index ] = easing;
				}
			}
		} else {
			specialEasing[ name ] = easing;
		}
	}
}

function Animation( elem, properties, options ) {
	var result,
		stopped,
		index = 0,
		length = Animation.prefilters.length,
		deferred = jQuery.Deferred().always( function() {

			// Don't match elem in the :animated selector
			delete tick.elem;
		} ),
		tick = function() {
			if ( stopped ) {
				return false;
			}
			var currentTime = fxNow || createFxNow(),
				remaining = Math.max( 0, animation.startTime + animation.duration - currentTime ),

				// Support: Android 2.3 only
				// Archaic crash bug won't allow us to use `1 - ( 0.5 || 0 )` (#12497)
				temp = remaining / animation.duration || 0,
				percent = 1 - temp,
				index = 0,
				length = animation.tweens.length;

			for ( ; index < length; index++ ) {
				animation.tweens[ index ].run( percent );
			}

			deferred.notifyWith( elem, [ animation, percent, remaining ] );

			// If there's more to do, yield
			if ( percent < 1 && length ) {
				return remaining;
			}

			// If this was an empty animation, synthesize a final progress notification
			if ( !length ) {
				deferred.notifyWith( elem, [ animation, 1, 0 ] );
			}

			// Resolve the animation and report its conclusion
			deferred.resolveWith( elem, [ animation ] );
			return false;
		},
		animation = deferred.promise( {
			elem: elem,
			props: jQuery.extend( {}, properties ),
			opts: jQuery.extend( true, {
				specialEasing: {},
				easing: jQuery.easing._default
			}, options ),
			originalProperties: properties,
			originalOptions: options,
			startTime: fxNow || createFxNow(),
			duration: options.duration,
			tweens: [],
			createTween: function( prop, end ) {
				var tween = jQuery.Tween( elem, animation.opts, prop, end,
						animation.opts.specialEasing[ prop ] || animation.opts.easing );
				animation.tweens.push( tween );
				return tween;
			},
			stop: function( gotoEnd ) {
				var index = 0,

					// If we are going to the end, we want to run all the tweens
					// otherwise we skip this part
					length = gotoEnd ? animation.tweens.length : 0;
				if ( stopped ) {
					return this;
				}
				stopped = true;
				for ( ; index < length; index++ ) {
					animation.tweens[ index ].run( 1 );
				}

				// Resolve when we played the last frame; otherwise, reject
				if ( gotoEnd ) {
					deferred.notifyWith( elem, [ animation, 1, 0 ] );
					deferred.resolveWith( elem, [ animation, gotoEnd ] );
				} else {
					deferred.rejectWith( elem, [ animation, gotoEnd ] );
				}
				return this;
			}
		} ),
		props = animation.props;

	propFilter( props, animation.opts.specialEasing );

	for ( ; index < length; index++ ) {
		result = Animation.prefilters[ index ].call( animation, elem, props, animation.opts );
		if ( result ) {
			if ( isFunction( result.stop ) ) {
				jQuery._queueHooks( animation.elem, animation.opts.queue ).stop =
					result.stop.bind( result );
			}
			return result;
		}
	}

	jQuery.map( props, createTween, animation );

	if ( isFunction( animation.opts.start ) ) {
		animation.opts.start.call( elem, animation );
	}

	// Attach callbacks from options
	animation
		.progress( animation.opts.progress )
		.done( animation.opts.done, animation.opts.complete )
		.fail( animation.opts.fail )
		.always( animation.opts.always );

	jQuery.fx.timer(
		jQuery.extend( tick, {
			elem: elem,
			anim: animation,
			queue: animation.opts.queue
		} )
	);

	return animation;
}

jQuery.Animation = jQuery.extend( Animation, {

	tweeners: {
		"*": [ function( prop, value ) {
			var tween = this.createTween( prop, value );
			adjustCSS( tween.elem, prop, rcssNum.exec( value ), tween );
			return tween;
		} ]
	},

	tweener: function( props, callback ) {
		if ( isFunction( props ) ) {
			callback = props;
			props = [ "*" ];
		} else {
			props = props.match( rnothtmlwhite );
		}

		var prop,
			index = 0,
			length = props.length;

		for ( ; index < length; index++ ) {
			prop = props[ index ];
			Animation.tweeners[ prop ] = Animation.tweeners[ prop ] || [];
			Animation.tweeners[ prop ].unshift( callback );
		}
	},

	prefilters: [ defaultPrefilter ],

	prefilter: function( callback, prepend ) {
		if ( prepend ) {
			Animation.prefilters.unshift( callback );
		} else {
			Animation.prefilters.push( callback );
		}
	}
} );

jQuery.speed = function( speed, easing, fn ) {
	var opt = speed && typeof speed === "object" ? jQuery.extend( {}, speed ) : {
		complete: fn || !fn && easing ||
			isFunction( speed ) && speed,
		duration: speed,
		easing: fn && easing || easing && !isFunction( easing ) && easing
	};

	// Go to the end state if fx are off
	if ( jQuery.fx.off ) {
		opt.duration = 0;

	} else {
		if ( typeof opt.duration !== "number" ) {
			if ( opt.duration in jQuery.fx.speeds ) {
				opt.duration = jQuery.fx.speeds[ opt.duration ];

			} else {
				opt.duration = jQuery.fx.speeds._default;
			}
		}
	}

	// Normalize opt.queue - true/undefined/null -> "fx"
	if ( opt.queue == null || opt.queue === true ) {
		opt.queue = "fx";
	}

	// Queueing
	opt.old = opt.complete;

	opt.complete = function() {
		if ( isFunction( opt.old ) ) {
			opt.old.call( this );
		}

		if ( opt.queue ) {
			jQuery.dequeue( this, opt.queue );
		}
	};

	return opt;
};

jQuery.fn.extend( {
	fadeTo: function( speed, to, easing, callback ) {

		// Show any hidden elements after setting opacity to 0
		return this.filter( isHiddenWithinTree ).css( "opacity", 0 ).show()

			// Animate to the value specified
			.end().animate( { opacity: to }, speed, easing, callback );
	},
	animate: function( prop, speed, easing, callback ) {
		var empty = jQuery.isEmptyObject( prop ),
			optall = jQuery.speed( speed, easing, callback ),
			doAnimation = function() {

				// Operate on a copy of prop so per-property easing won't be lost
				var anim = Animation( this, jQuery.extend( {}, prop ), optall );

				// Empty animations, or finishing resolves immediately
				if ( empty || dataPriv.get( this, "finish" ) ) {
					anim.stop( true );
				}
			};
			doAnimation.finish = doAnimation;

		return empty || optall.queue === false ?
			this.each( doAnimation ) :
			this.queue( optall.queue, doAnimation );
	},
	stop: function( type, clearQueue, gotoEnd ) {
		var stopQueue = function( hooks ) {
			var stop = hooks.stop;
			delete hooks.stop;
			stop( gotoEnd );
		};

		if ( typeof type !== "string" ) {
			gotoEnd = clearQueue;
			clearQueue = type;
			type = undefined;
		}
		if ( clearQueue && type !== false ) {
			this.queue( type || "fx", [] );
		}

		return this.each( function() {
			var dequeue = true,
				index = type != null && type + "queueHooks",
				timers = jQuery.timers,
				data = dataPriv.get( this );

			if ( index ) {
				if ( data[ index ] && data[ index ].stop ) {
					stopQueue( data[ index ] );
				}
			} else {
				for ( index in data ) {
					if ( data[ index ] && data[ index ].stop && rrun.test( index ) ) {
						stopQueue( data[ index ] );
					}
				}
			}

			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this &&
					( type == null || timers[ index ].queue === type ) ) {

					timers[ index ].anim.stop( gotoEnd );
					dequeue = false;
					timers.splice( index, 1 );
				}
			}

			// Start the next in the queue if the last step wasn't forced.
			// Timers currently will call their complete callbacks, which
			// will dequeue but only if they were gotoEnd.
			if ( dequeue || !gotoEnd ) {
				jQuery.dequeue( this, type );
			}
		} );
	},
	finish: function( type ) {
		if ( type !== false ) {
			type = type || "fx";
		}
		return this.each( function() {
			var index,
				data = dataPriv.get( this ),
				queue = data[ type + "queue" ],
				hooks = data[ type + "queueHooks" ],
				timers = jQuery.timers,
				length = queue ? queue.length : 0;

			// Enable finishing flag on private data
			data.finish = true;

			// Empty the queue first
			jQuery.queue( this, type, [] );

			if ( hooks && hooks.stop ) {
				hooks.stop.call( this, true );
			}

			// Look for any active animations, and finish them
			for ( index = timers.length; index--; ) {
				if ( timers[ index ].elem === this && timers[ index ].queue === type ) {
					timers[ index ].anim.stop( true );
					timers.splice( index, 1 );
				}
			}

			// Look for any animations in the old queue and finish them
			for ( index = 0; index < length; index++ ) {
				if ( queue[ index ] && queue[ index ].finish ) {
					queue[ index ].finish.call( this );
				}
			}

			// Turn off finishing flag
			delete data.finish;
		} );
	}
} );

jQuery.each( [ "toggle", "show", "hide" ], function( i, name ) {
	var cssFn = jQuery.fn[ name ];
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return speed == null || typeof speed === "boolean" ?
			cssFn.apply( this, arguments ) :
			this.animate( genFx( name, true ), speed, easing, callback );
	};
} );

// Generate shortcuts for custom animations
jQuery.each( {
	slideDown: genFx( "show" ),
	slideUp: genFx( "hide" ),
	slideToggle: genFx( "toggle" ),
	fadeIn: { opacity: "show" },
	fadeOut: { opacity: "hide" },
	fadeToggle: { opacity: "toggle" }
}, function( name, props ) {
	jQuery.fn[ name ] = function( speed, easing, callback ) {
		return this.animate( props, speed, easing, callback );
	};
} );

jQuery.timers = [];
jQuery.fx.tick = function() {
	var timer,
		i = 0,
		timers = jQuery.timers;

	fxNow = Date.now();

	for ( ; i < timers.length; i++ ) {
		timer = timers[ i ];

		// Run the timer and safely remove it when done (allowing for external removal)
		if ( !timer() && timers[ i ] === timer ) {
			timers.splice( i--, 1 );
		}
	}

	if ( !timers.length ) {
		jQuery.fx.stop();
	}
	fxNow = undefined;
};

jQuery.fx.timer = function( timer ) {
	jQuery.timers.push( timer );
	jQuery.fx.start();
};

jQuery.fx.interval = 13;
jQuery.fx.start = function() {
	if ( inProgress ) {
		return;
	}

	inProgress = true;
	schedule();
};

jQuery.fx.stop = function() {
	inProgress = null;
};

jQuery.fx.speeds = {
	slow: 600,
	fast: 200,

	// Default speed
	_default: 400
};


// Based off of the plugin by Clint Helfers, with permission.
// https://web.archive.org/web/20100324014747/http://blindsignals.com/index.php/2009/07/jquery-delay/
jQuery.fn.delay = function( time, type ) {
	time = jQuery.fx ? jQuery.fx.speeds[ time ] || time : time;
	type = type || "fx";

	return this.queue( type, function( next, hooks ) {
		var timeout = window.setTimeout( next, time );
		hooks.stop = function() {
			window.clearTimeout( timeout );
		};
	} );
};


( function() {
	var input = document.createElement( "input" ),
		select = document.createElement( "select" ),
		opt = select.appendChild( document.createElement( "option" ) );

	input.type = "checkbox";

	// Support: Android <=4.3 only
	// Default value for a checkbox should be "on"
	support.checkOn = input.value !== "";

	// Support: IE <=11 only
	// Must access selectedIndex to make default options select
	support.optSelected = opt.selected;

	// Support: IE <=11 only
	// An input loses its value after becoming a radio
	input = document.createElement( "input" );
	input.value = "t";
	input.type = "radio";
	support.radioValue = input.value === "t";
} )();


var boolHook,
	attrHandle = jQuery.expr.attrHandle;

jQuery.fn.extend( {
	attr: function( name, value ) {
		return access( this, jQuery.attr, name, value, arguments.length > 1 );
	},

	removeAttr: function( name ) {
		return this.each( function() {
			jQuery.removeAttr( this, name );
		} );
	}
} );

jQuery.extend( {
	attr: function( elem, name, value ) {
		var ret, hooks,
			nType = elem.nodeType;

		// Don't get/set attributes on text, comment and attribute nodes
		if ( nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		// Fallback to prop when attributes are not supported
		if ( typeof elem.getAttribute === "undefined" ) {
			return jQuery.prop( elem, name, value );
		}

		// Attribute hooks are determined by the lowercase version
		// Grab necessary hook if one is defined
		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {
			hooks = jQuery.attrHooks[ name.toLowerCase() ] ||
				( jQuery.expr.match.bool.test( name ) ? boolHook : undefined );
		}

		if ( value !== undefined ) {
			if ( value === null ) {
				jQuery.removeAttr( elem, name );
				return;
			}

			if ( hooks && "set" in hooks &&
				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
				return ret;
			}

			elem.setAttribute( name, value + "" );
			return value;
		}

		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
			return ret;
		}

		ret = jQuery.find.attr( elem, name );

		// Non-existent attributes return null, we normalize to undefined
		return ret == null ? undefined : ret;
	},

	attrHooks: {
		type: {
			set: function( elem, value ) {
				if ( !support.radioValue && value === "radio" &&
					nodeName( elem, "input" ) ) {
					var val = elem.value;
					elem.setAttribute( "type", value );
					if ( val ) {
						elem.value = val;
					}
					return value;
				}
			}
		}
	},

	removeAttr: function( elem, value ) {
		var name,
			i = 0,

			// Attribute names can contain non-HTML whitespace characters
			// https://html.spec.whatwg.org/multipage/syntax.html#attributes-2
			attrNames = value && value.match( rnothtmlwhite );

		if ( attrNames && elem.nodeType === 1 ) {
			while ( ( name = attrNames[ i++ ] ) ) {
				elem.removeAttribute( name );
			}
		}
	}
} );

// Hooks for boolean attributes
boolHook = {
	set: function( elem, value, name ) {
		if ( value === false ) {

			// Remove boolean attributes when set to false
			jQuery.removeAttr( elem, name );
		} else {
			elem.setAttribute( name, name );
		}
		return name;
	}
};

jQuery.each( jQuery.expr.match.bool.source.match( /\w+/g ), function( i, name ) {
	var getter = attrHandle[ name ] || jQuery.find.attr;

	attrHandle[ name ] = function( elem, name, isXML ) {
		var ret, handle,
			lowercaseName = name.toLowerCase();

		if ( !isXML ) {

			// Avoid an infinite loop by temporarily removing this function from the getter
			handle = attrHandle[ lowercaseName ];
			attrHandle[ lowercaseName ] = ret;
			ret = getter( elem, name, isXML ) != null ?
				lowercaseName :
				null;
			attrHandle[ lowercaseName ] = handle;
		}
		return ret;
	};
} );




var rfocusable = /^(?:input|select|textarea|button)$/i,
	rclickable = /^(?:a|area)$/i;

jQuery.fn.extend( {
	prop: function( name, value ) {
		return access( this, jQuery.prop, name, value, arguments.length > 1 );
	},

	removeProp: function( name ) {
		return this.each( function() {
			delete this[ jQuery.propFix[ name ] || name ];
		} );
	}
} );

jQuery.extend( {
	prop: function( elem, name, value ) {
		var ret, hooks,
			nType = elem.nodeType;

		// Don't get/set properties on text, comment and attribute nodes
		if ( nType === 3 || nType === 8 || nType === 2 ) {
			return;
		}

		if ( nType !== 1 || !jQuery.isXMLDoc( elem ) ) {

			// Fix name and attach hooks
			name = jQuery.propFix[ name ] || name;
			hooks = jQuery.propHooks[ name ];
		}

		if ( value !== undefined ) {
			if ( hooks && "set" in hooks &&
				( ret = hooks.set( elem, value, name ) ) !== undefined ) {
				return ret;
			}

			return ( elem[ name ] = value );
		}

		if ( hooks && "get" in hooks && ( ret = hooks.get( elem, name ) ) !== null ) {
			return ret;
		}

		return elem[ name ];
	},

	propHooks: {
		tabIndex: {
			get: function( elem ) {

				// Support: IE <=9 - 11 only
				// elem.tabIndex doesn't always return the
				// correct value when it hasn't been explicitly set
				// https://web.archive.org/web/20141116233347/http://fluidproject.org/blog/2008/01/09/getting-setting-and-removing-tabindex-values-with-javascript/
				// Use proper attribute retrieval(#12072)
				var tabindex = jQuery.find.attr( elem, "tabindex" );

				if ( tabindex ) {
					return parseInt( tabindex, 10 );
				}

				if (
					rfocusable.test( elem.nodeName ) ||
					rclickable.test( elem.nodeName ) &&
					elem.href
				) {
					return 0;
				}

				return -1;
			}
		}
	},

	propFix: {
		"for": "htmlFor",
		"class": "className"
	}
} );

// Support: IE <=11 only
// Accessing the selectedIndex property
// forces the browser to respect setting selected
// on the option
// The getter ensures a default option is selected
// when in an optgroup
// eslint rule "no-unused-expressions" is disabled for this code
// since it considers such accessions noop
if ( !support.optSelected ) {
	jQuery.propHooks.selected = {
		get: function( elem ) {

			/* eslint no-unused-expressions: "off" */

			var parent = elem.parentNode;
			if ( parent && parent.parentNode ) {
				parent.parentNode.selectedIndex;
			}
			return null;
		},
		set: function( elem ) {

			/* eslint no-unused-expressions: "off" */

			var parent = elem.parentNode;
			if ( parent ) {
				parent.selectedIndex;

				if ( parent.parentNode ) {
					parent.parentNode.selectedIndex;
				}
			}
		}
	};
}

jQuery.each( [
	"tabIndex",
	"readOnly",
	"maxLength",
	"cellSpacing",
	"cellPadding",
	"rowSpan",
	"colSpan",
	"useMap",
	"frameBorder",
	"contentEditable"
], function() {
	jQuery.propFix[ this.toLowerCase() ] = this;
} );




	// Strip and collapse whitespace according to HTML spec
	// https://infra.spec.whatwg.org/#strip-and-collapse-ascii-whitespace
	function stripAndCollapse( value ) {
		var tokens = value.match( rnothtmlwhite ) || [];
		return tokens.join( " " );
	}


function getClass( elem ) {
	return elem.getAttribute && elem.getAttribute( "class" ) || "";
}

function classesToArray( value ) {
	if ( Array.isArray( value ) ) {
		return value;
	}
	if ( typeof value === "string" ) {
		return value.match( rnothtmlwhite ) || [];
	}
	return [];
}

jQuery.fn.extend( {
	addClass: function( value ) {
		var classes, elem, cur, curValue, clazz, j, finalValue,
			i = 0;

		if ( isFunction( value ) ) {
			return this.each( function( j ) {
				jQuery( this ).addClass( value.call( this, j, getClass( this ) ) );
			} );
		}

		classes = classesToArray( value );

		if ( classes.length ) {
			while ( ( elem = this[ i++ ] ) ) {
				curValue = getClass( elem );
				cur = elem.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

				if ( cur ) {
					j = 0;
					while ( ( clazz = classes[ j++ ] ) ) {
						if ( cur.indexOf( " " + clazz + " " ) < 0 ) {
							cur += clazz + " ";
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = stripAndCollapse( cur );
					if ( curValue !== finalValue ) {
						elem.setAttribute( "class", finalValue );
					}
				}
			}
		}

		return this;
	},

	removeClass: function( value ) {
		var classes, elem, cur, curValue, clazz, j, finalValue,
			i = 0;

		if ( isFunction( value ) ) {
			return this.each( function( j ) {
				jQuery( this ).removeClass( value.call( this, j, getClass( this ) ) );
			} );
		}

		if ( !arguments.length ) {
			return this.attr( "class", "" );
		}

		classes = classesToArray( value );

		if ( classes.length ) {
			while ( ( elem = this[ i++ ] ) ) {
				curValue = getClass( elem );

				// This expression is here for better compressibility (see addClass)
				cur = elem.nodeType === 1 && ( " " + stripAndCollapse( curValue ) + " " );

				if ( cur ) {
					j = 0;
					while ( ( clazz = classes[ j++ ] ) ) {

						// Remove *all* instances
						while ( cur.indexOf( " " + clazz + " " ) > -1 ) {
							cur = cur.replace( " " + clazz + " ", " " );
						}
					}

					// Only assign if different to avoid unneeded rendering.
					finalValue = stripAndCollapse( cur );
					if ( curValue !== finalValue ) {
						elem.setAttribute( "class", finalValue );
					}
				}
			}
		}

		return this;
	},

	toggleClass: function( value, stateVal ) {
		var type = typeof value,
			isValidValue = type === "string" || Array.isArray( value );

		if ( typeof stateVal === "boolean" && isValidValue ) {
			return stateVal ? this.addClass( value ) : this.removeClass( value );
		}

		if ( isFunction( value ) ) {
			return this.each( function( i ) {
				jQuery( this ).toggleClass(
					value.call( this, i, getClass( this ), stateVal ),
					stateVal
				);
			} );
		}

		return this.each( function() {
			var className, i, self, classNames;

			if ( isValidValue ) {

				// Toggle individual class names
				i = 0;
				self = jQuery( this );
				classNames = classesToArray( value );

				while ( ( className = classNames[ i++ ] ) ) {

					// Check each className given, space separated list
					if ( self.hasClass( className ) ) {
						self.removeClass( className );
					} else {
						self.addClass( className );
					}
				}

			// Toggle whole class name
			} else if ( value === undefined || type === "boolean" ) {
				className = getClass( this );
				if ( className ) {

					// Store className if set
					dataPriv.set( this, "__className__", className );
				}

				// If the element has a class name or if we're passed `false`,
				// then remove the whole classname (if there was one, the above saved it).
				// Otherwise bring back whatever was previously saved (if anything),
				// falling back to the empty string if nothing was stored.
				if ( this.setAttribute ) {
					this.setAttribute( "class",
						className || value === false ?
						"" :
						dataPriv.get( this, "__className__" ) || ""
					);
				}
			}
		} );
	},

	hasClass: function( selector ) {
		var className, elem,
			i = 0;

		className = " " + selector + " ";
		while ( ( elem = this[ i++ ] ) ) {
			if ( elem.nodeType === 1 &&
				( " " + stripAndCollapse( getClass( elem ) ) + " " ).indexOf( className ) > -1 ) {
					return true;
			}
		}

		return false;
	}
} );




var rreturn = /\r/g;

jQuery.fn.extend( {
	val: function( value ) {
		var hooks, ret, valueIsFunction,
			elem = this[ 0 ];

		if ( !arguments.length ) {
			if ( elem ) {
				hooks = jQuery.valHooks[ elem.type ] ||
					jQuery.valHooks[ elem.nodeName.toLowerCase() ];

				if ( hooks &&
					"get" in hooks &&
					( ret = hooks.get( elem, "value" ) ) !== undefined
				) {
					return ret;
				}

				ret = elem.value;

				// Handle most common string cases
				if ( typeof ret === "string" ) {
					return ret.replace( rreturn, "" );
				}

				// Handle cases where value is null/undef or number
				return ret == null ? "" : ret;
			}

			return;
		}

		valueIsFunction = isFunction( value );

		return this.each( function( i ) {
			var val;

			if ( this.nodeType !== 1 ) {
				return;
			}

			if ( valueIsFunction ) {
				val = value.call( this, i, jQuery( this ).val() );
			} else {
				val = value;
			}

			// Treat null/undefined as ""; convert numbers to string
			if ( val == null ) {
				val = "";

			} else if ( typeof val === "number" ) {
				val += "";

			} else if ( Array.isArray( val ) ) {
				val = jQuery.map( val, function( value ) {
					return value == null ? "" : value + "";
				} );
			}

			hooks = jQuery.valHooks[ this.type ] || jQuery.valHooks[ this.nodeName.toLowerCase() ];

			// If set returns undefined, fall back to normal setting
			if ( !hooks || !( "set" in hooks ) || hooks.set( this, val, "value" ) === undefined ) {
				this.value = val;
			}
		} );
	}
} );

jQuery.extend( {
	valHooks: {
		option: {
			get: function( elem ) {

				var val = jQuery.find.attr( elem, "value" );
				return val != null ?
					val :

					// Support: IE <=10 - 11 only
					// option.text throws exceptions (#14686, #14858)
					// Strip and collapse whitespace
					// https://html.spec.whatwg.org/#strip-and-collapse-whitespace
					stripAndCollapse( jQuery.text( elem ) );
			}
		},
		select: {
			get: function( elem ) {
				var value, option, i,
					options = elem.options,
					index = elem.selectedIndex,
					one = elem.type === "select-one",
					values = one ? null : [],
					max = one ? index + 1 : options.length;

				if ( index < 0 ) {
					i = max;

				} else {
					i = one ? index : 0;
				}

				// Loop through all the selected options
				for ( ; i < max; i++ ) {
					option = options[ i ];

					// Support: IE <=9 only
					// IE8-9 doesn't update selected after form reset (#2551)
					if ( ( option.selected || i === index ) &&

							// Don't return options that are disabled or in a disabled optgroup
							!option.disabled &&
							( !option.parentNode.disabled ||
								!nodeName( option.parentNode, "optgroup" ) ) ) {

						// Get the specific value for the option
						value = jQuery( option ).val();

						// We don't need an array for one selects
						if ( one ) {
							return value;
						}

						// Multi-Selects return an array
						values.push( value );
					}
				}

				return values;
			},

			set: function( elem, value ) {
				var optionSet, option,
					options = elem.options,
					values = jQuery.makeArray( value ),
					i = options.length;

				while ( i-- ) {
					option = options[ i ];

					/* eslint-disable no-cond-assign */

					if ( option.selected =
						jQuery.inArray( jQuery.valHooks.option.get( option ), values ) > -1
					) {
						optionSet = true;
					}

					/* eslint-enable no-cond-assign */
				}

				// Force browsers to behave consistently when non-matching value is set
				if ( !optionSet ) {
					elem.selectedIndex = -1;
				}
				return values;
			}
		}
	}
} );

// Radios and checkboxes getter/setter
jQuery.each( [ "radio", "checkbox" ], function() {
	jQuery.valHooks[ this ] = {
		set: function( elem, value ) {
			if ( Array.isArray( value ) ) {
				return ( elem.checked = jQuery.inArray( jQuery( elem ).val(), value ) > -1 );
			}
		}
	};
	if ( !support.checkOn ) {
		jQuery.valHooks[ this ].get = function( elem ) {
			return elem.getAttribute( "value" ) === null ? "on" : elem.value;
		};
	}
} );




// Return jQuery for attributes-only inclusion


support.focusin = "onfocusin" in window;


var rfocusMorph = /^(?:focusinfocus|focusoutblur)$/,
	stopPropagationCallback = function( e ) {
		e.stopPropagation();
	};

jQuery.extend( jQuery.event, {

	trigger: function( event, data, elem, onlyHandlers ) {

		var i, cur, tmp, bubbleType, ontype, handle, special, lastElement,
			eventPath = [ elem || document ],
			type = hasOwn.call( event, "type" ) ? event.type : event,
			namespaces = hasOwn.call( event, "namespace" ) ? event.namespace.split( "." ) : [];

		cur = lastElement = tmp = elem = elem || document;

		// Don't do events on text and comment nodes
		if ( elem.nodeType === 3 || elem.nodeType === 8 ) {
			return;
		}

		// focus/blur morphs to focusin/out; ensure we're not firing them right now
		if ( rfocusMorph.test( type + jQuery.event.triggered ) ) {
			return;
		}

		if ( type.indexOf( "." ) > -1 ) {

			// Namespaced trigger; create a regexp to match event type in handle()
			namespaces = type.split( "." );
			type = namespaces.shift();
			namespaces.sort();
		}
		ontype = type.indexOf( ":" ) < 0 && "on" + type;

		// Caller can pass in a jQuery.Event object, Object, or just an event type string
		event = event[ jQuery.expando ] ?
			event :
			new jQuery.Event( type, typeof event === "object" && event );

		// Trigger bitmask: & 1 for native handlers; & 2 for jQuery (always true)
		event.isTrigger = onlyHandlers ? 2 : 3;
		event.namespace = namespaces.join( "." );
		event.rnamespace = event.namespace ?
			new RegExp( "(^|\\.)" + namespaces.join( "\\.(?:.*\\.|)" ) + "(\\.|$)" ) :
			null;

		// Clean up the event in case it is being reused
		event.result = undefined;
		if ( !event.target ) {
			event.target = elem;
		}

		// Clone any incoming data and prepend the event, creating the handler arg list
		data = data == null ?
			[ event ] :
			jQuery.makeArray( data, [ event ] );

		// Allow special events to draw outside the lines
		special = jQuery.event.special[ type ] || {};
		if ( !onlyHandlers && special.trigger && special.trigger.apply( elem, data ) === false ) {
			return;
		}

		// Determine event propagation path in advance, per W3C events spec (#9951)
		// Bubble up to document, then to window; watch for a global ownerDocument var (#9724)
		if ( !onlyHandlers && !special.noBubble && !isWindow( elem ) ) {

			bubbleType = special.delegateType || type;
			if ( !rfocusMorph.test( bubbleType + type ) ) {
				cur = cur.parentNode;
			}
			for ( ; cur; cur = cur.parentNode ) {
				eventPath.push( cur );
				tmp = cur;
			}

			// Only add window if we got to document (e.g., not plain obj or detached DOM)
			if ( tmp === ( elem.ownerDocument || document ) ) {
				eventPath.push( tmp.defaultView || tmp.parentWindow || window );
			}
		}

		// Fire handlers on the event path
		i = 0;
		while ( ( cur = eventPath[ i++ ] ) && !event.isPropagationStopped() ) {
			lastElement = cur;
			event.type = i > 1 ?
				bubbleType :
				special.bindType || type;

			// jQuery handler
			handle = ( dataPriv.get( cur, "events" ) || {} )[ event.type ] &&
				dataPriv.get( cur, "handle" );
			if ( handle ) {
				handle.apply( cur, data );
			}

			// Native handler
			handle = ontype && cur[ ontype ];
			if ( handle && handle.apply && acceptData( cur ) ) {
				event.result = handle.apply( cur, data );
				if ( event.result === false ) {
					event.preventDefault();
				}
			}
		}
		event.type = type;

		// If nobody prevented the default action, do it now
		if ( !onlyHandlers && !event.isDefaultPrevented() ) {

			if ( ( !special._default ||
				special._default.apply( eventPath.pop(), data ) === false ) &&
				acceptData( elem ) ) {

				// Call a native DOM method on the target with the same name as the event.
				// Don't do default actions on window, that's where global variables be (#6170)
				if ( ontype && isFunction( elem[ type ] ) && !isWindow( elem ) ) {

					// Don't re-trigger an onFOO event when we call its FOO() method
					tmp = elem[ ontype ];

					if ( tmp ) {
						elem[ ontype ] = null;
					}

					// Prevent re-triggering of the same event, since we already bubbled it above
					jQuery.event.triggered = type;

					if ( event.isPropagationStopped() ) {
						lastElement.addEventListener( type, stopPropagationCallback );
					}

					elem[ type ]();

					if ( event.isPropagationStopped() ) {
						lastElement.removeEventListener( type, stopPropagationCallback );
					}

					jQuery.event.triggered = undefined;

					if ( tmp ) {
						elem[ ontype ] = tmp;
					}
				}
			}
		}

		return event.result;
	},

	// Piggyback on a donor event to simulate a different one
	// Used only for `focus(in | out)` events
	simulate: function( type, elem, event ) {
		var e = jQuery.extend(
			new jQuery.Event(),
			event,
			{
				type: type,
				isSimulated: true
			}
		);

		jQuery.event.trigger( e, null, elem );
	}

} );

jQuery.fn.extend( {

	trigger: function( type, data ) {
		return this.each( function() {
			jQuery.event.trigger( type, data, this );
		} );
	},
	triggerHandler: function( type, data ) {
		var elem = this[ 0 ];
		if ( elem ) {
			return jQuery.event.trigger( type, data, elem, true );
		}
	}
} );


// Support: Firefox <=44
// Firefox doesn't have focus(in | out) events
// Related ticket - https://bugzilla.mozilla.org/show_bug.cgi?id=687787
//
// Support: Chrome <=48 - 49, Safari <=9.0 - 9.1
// focus(in | out) events fire after focus & blur events,
// which is spec violation - http://www.w3.org/TR/DOM-Level-3-Events/#events-focusevent-event-order
// Related ticket - https://bugs.chromium.org/p/chromium/issues/detail?id=449857
if ( !support.focusin ) {
	jQuery.each( { focus: "focusin", blur: "focusout" }, function( orig, fix ) {

		// Attach a single capturing handler on the document while someone wants focusin/focusout
		var handler = function( event ) {
			jQuery.event.simulate( fix, event.target, jQuery.event.fix( event ) );
		};

		jQuery.event.special[ fix ] = {
			setup: function() {
				var doc = this.ownerDocument || this,
					attaches = dataPriv.access( doc, fix );

				if ( !attaches ) {
					doc.addEventListener( orig, handler, true );
				}
				dataPriv.access( doc, fix, ( attaches || 0 ) + 1 );
			},
			teardown: function() {
				var doc = this.ownerDocument || this,
					attaches = dataPriv.access( doc, fix ) - 1;

				if ( !attaches ) {
					doc.removeEventListener( orig, handler, true );
					dataPriv.remove( doc, fix );

				} else {
					dataPriv.access( doc, fix, attaches );
				}
			}
		};
	} );
}
var location = window.location;

var nonce = Date.now();

var rquery = ( /\?/ );



// Cross-browser xml parsing
jQuery.parseXML = function( data ) {
	var xml;
	if ( !data || typeof data !== "string" ) {
		return null;
	}

	// Support: IE 9 - 11 only
	// IE throws on parseFromString with invalid input.
	try {
		xml = ( new window.DOMParser() ).parseFromString( data, "text/xml" );
	} catch ( e ) {
		xml = undefined;
	}

	if ( !xml || xml.getElementsByTagName( "parsererror" ).length ) {
		jQuery.error( "Invalid XML: " + data );
	}
	return xml;
};


var
	rbracket = /\[\]$/,
	rCRLF = /\r?\n/g,
	rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
	rsubmittable = /^(?:input|select|textarea|keygen)/i;

function buildParams( prefix, obj, traditional, add ) {
	var name;

	if ( Array.isArray( obj ) ) {

		// Serialize array item.
		jQuery.each( obj, function( i, v ) {
			if ( traditional || rbracket.test( prefix ) ) {

				// Treat each array item as a scalar.
				add( prefix, v );

			} else {

				// Item is non-scalar (array or object), encode its numeric index.
				buildParams(
					prefix + "[" + ( typeof v === "object" && v != null ? i : "" ) + "]",
					v,
					traditional,
					add
				);
			}
		} );

	} else if ( !traditional && toType( obj ) === "object" ) {

		// Serialize object item.
		for ( name in obj ) {
			buildParams( prefix + "[" + name + "]", obj[ name ], traditional, add );
		}

	} else {

		// Serialize scalar item.
		add( prefix, obj );
	}
}

// Serialize an array of form elements or a set of
// key/values into a query string
jQuery.param = function( a, traditional ) {
	var prefix,
		s = [],
		add = function( key, valueOrFunction ) {

			// If value is a function, invoke it and use its return value
			var value = isFunction( valueOrFunction ) ?
				valueOrFunction() :
				valueOrFunction;

			s[ s.length ] = encodeURIComponent( key ) + "=" +
				encodeURIComponent( value == null ? "" : value );
		};

	if ( a == null ) {
		return "";
	}

	// If an array was passed in, assume that it is an array of form elements.
	if ( Array.isArray( a ) || ( a.jquery && !jQuery.isPlainObject( a ) ) ) {

		// Serialize the form elements
		jQuery.each( a, function() {
			add( this.name, this.value );
		} );

	} else {

		// If traditional, encode the "old" way (the way 1.3.2 or older
		// did it), otherwise encode params recursively.
		for ( prefix in a ) {
			buildParams( prefix, a[ prefix ], traditional, add );
		}
	}

	// Return the resulting serialization
	return s.join( "&" );
};

jQuery.fn.extend( {
	serialize: function() {
		return jQuery.param( this.serializeArray() );
	},
	serializeArray: function() {
		return this.map( function() {

			// Can add propHook for "elements" to filter or add form elements
			var elements = jQuery.prop( this, "elements" );
			return elements ? jQuery.makeArray( elements ) : this;
		} )
		.filter( function() {
			var type = this.type;

			// Use .is( ":disabled" ) so that fieldset[disabled] works
			return this.name && !jQuery( this ).is( ":disabled" ) &&
				rsubmittable.test( this.nodeName ) && !rsubmitterTypes.test( type ) &&
				( this.checked || !rcheckableType.test( type ) );
		} )
		.map( function( i, elem ) {
			var val = jQuery( this ).val();

			if ( val == null ) {
				return null;
			}

			if ( Array.isArray( val ) ) {
				return jQuery.map( val, function( val ) {
					return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
				} );
			}

			return { name: elem.name, value: val.replace( rCRLF, "\r\n" ) };
		} ).get();
	}
} );


var
	r20 = /%20/g,
	rhash = /#.*$/,
	rantiCache = /([?&])_=[^&]*/,
	rheaders = /^(.*?):[ \t]*([^\r\n]*)$/mg,

	// #7653, #8125, #8152: local protocol detection
	rlocalProtocol = /^(?:about|app|app-storage|.+-extension|file|res|widget):$/,
	rnoContent = /^(?:GET|HEAD)$/,
	rprotocol = /^\/\//,

	/* Prefilters
	 * 1) They are useful to introduce custom dataTypes (see ajax/jsonp.js for an example)
	 * 2) These are called:
	 *    - BEFORE asking for a transport
	 *    - AFTER param serialization (s.data is a string if s.processData is true)
	 * 3) key is the dataType
	 * 4) the catchall symbol "*" can be used
	 * 5) execution will start with transport dataType and THEN continue down to "*" if needed
	 */
	prefilters = {},

	/* Transports bindings
	 * 1) key is the dataType
	 * 2) the catchall symbol "*" can be used
	 * 3) selection will start with transport dataType and THEN go to "*" if needed
	 */
	transports = {},

	// Avoid comment-prolog char sequence (#10098); must appease lint and evade compression
	allTypes = "*/".concat( "*" ),

	// Anchor tag for parsing the document origin
	originAnchor = document.createElement( "a" );
	originAnchor.href = location.href;

// Base "constructor" for jQuery.ajaxPrefilter and jQuery.ajaxTransport
function addToPrefiltersOrTransports( structure ) {

	// dataTypeExpression is optional and defaults to "*"
	return function( dataTypeExpression, func ) {

		if ( typeof dataTypeExpression !== "string" ) {
			func = dataTypeExpression;
			dataTypeExpression = "*";
		}

		var dataType,
			i = 0,
			dataTypes = dataTypeExpression.toLowerCase().match( rnothtmlwhite ) || [];

		if ( isFunction( func ) ) {

			// For each dataType in the dataTypeExpression
			while ( ( dataType = dataTypes[ i++ ] ) ) {

				// Prepend if requested
				if ( dataType[ 0 ] === "+" ) {
					dataType = dataType.slice( 1 ) || "*";
					( structure[ dataType ] = structure[ dataType ] || [] ).unshift( func );

				// Otherwise append
				} else {
					( structure[ dataType ] = structure[ dataType ] || [] ).push( func );
				}
			}
		}
	};
}

// Base inspection function for prefilters and transports
function inspectPrefiltersOrTransports( structure, options, originalOptions, jqXHR ) {

	var inspected = {},
		seekingTransport = ( structure === transports );

	function inspect( dataType ) {
		var selected;
		inspected[ dataType ] = true;
		jQuery.each( structure[ dataType ] || [], function( _, prefilterOrFactory ) {
			var dataTypeOrTransport = prefilterOrFactory( options, originalOptions, jqXHR );
			if ( typeof dataTypeOrTransport === "string" &&
				!seekingTransport && !inspected[ dataTypeOrTransport ] ) {

				options.dataTypes.unshift( dataTypeOrTransport );
				inspect( dataTypeOrTransport );
				return false;
			} else if ( seekingTransport ) {
				return !( selected = dataTypeOrTransport );
			}
		} );
		return selected;
	}

	return inspect( options.dataTypes[ 0 ] ) || !inspected[ "*" ] && inspect( "*" );
}

// A special extend for ajax options
// that takes "flat" options (not to be deep extended)
// Fixes #9887
function ajaxExtend( target, src ) {
	var key, deep,
		flatOptions = jQuery.ajaxSettings.flatOptions || {};

	for ( key in src ) {
		if ( src[ key ] !== undefined ) {
			( flatOptions[ key ] ? target : ( deep || ( deep = {} ) ) )[ key ] = src[ key ];
		}
	}
	if ( deep ) {
		jQuery.extend( true, target, deep );
	}

	return target;
}

/* Handles responses to an ajax request:
 * - finds the right dataType (mediates between content-type and expected dataType)
 * - returns the corresponding response
 */
function ajaxHandleResponses( s, jqXHR, responses ) {

	var ct, type, finalDataType, firstDataType,
		contents = s.contents,
		dataTypes = s.dataTypes;

	// Remove auto dataType and get content-type in the process
	while ( dataTypes[ 0 ] === "*" ) {
		dataTypes.shift();
		if ( ct === undefined ) {
			ct = s.mimeType || jqXHR.getResponseHeader( "Content-Type" );
		}
	}

	// Check if we're dealing with a known content-type
	if ( ct ) {
		for ( type in contents ) {
			if ( contents[ type ] && contents[ type ].test( ct ) ) {
				dataTypes.unshift( type );
				break;
			}
		}
	}

	// Check to see if we have a response for the expected dataType
	if ( dataTypes[ 0 ] in responses ) {
		finalDataType = dataTypes[ 0 ];
	} else {

		// Try convertible dataTypes
		for ( type in responses ) {
			if ( !dataTypes[ 0 ] || s.converters[ type + " " + dataTypes[ 0 ] ] ) {
				finalDataType = type;
				break;
			}
			if ( !firstDataType ) {
				firstDataType = type;
			}
		}

		// Or just use first one
		finalDataType = finalDataType || firstDataType;
	}

	// If we found a dataType
	// We add the dataType to the list if needed
	// and return the corresponding response
	if ( finalDataType ) {
		if ( finalDataType !== dataTypes[ 0 ] ) {
			dataTypes.unshift( finalDataType );
		}
		return responses[ finalDataType ];
	}
}

/* Chain conversions given the request and the original response
 * Also sets the responseXXX fields on the jqXHR instance
 */
function ajaxConvert( s, response, jqXHR, isSuccess ) {
	var conv2, current, conv, tmp, prev,
		converters = {},

		// Work with a copy of dataTypes in case we need to modify it for conversion
		dataTypes = s.dataTypes.slice();

	// Create converters map with lowercased keys
	if ( dataTypes[ 1 ] ) {
		for ( conv in s.converters ) {
			converters[ conv.toLowerCase() ] = s.converters[ conv ];
		}
	}

	current = dataTypes.shift();

	// Convert to each sequential dataType
	while ( current ) {

		if ( s.responseFields[ current ] ) {
			jqXHR[ s.responseFields[ current ] ] = response;
		}

		// Apply the dataFilter if provided
		if ( !prev && isSuccess && s.dataFilter ) {
			response = s.dataFilter( response, s.dataType );
		}

		prev = current;
		current = dataTypes.shift();

		if ( current ) {

			// There's only work to do if current dataType is non-auto
			if ( current === "*" ) {

				current = prev;

			// Convert response if prev dataType is non-auto and differs from current
			} else if ( prev !== "*" && prev !== current ) {

				// Seek a direct converter
				conv = converters[ prev + " " + current ] || converters[ "* " + current ];

				// If none found, seek a pair
				if ( !conv ) {
					for ( conv2 in converters ) {

						// If conv2 outputs current
						tmp = conv2.split( " " );
						if ( tmp[ 1 ] === current ) {

							// If prev can be converted to accepted input
							conv = converters[ prev + " " + tmp[ 0 ] ] ||
								converters[ "* " + tmp[ 0 ] ];
							if ( conv ) {

								// Condense equivalence converters
								if ( conv === true ) {
									conv = converters[ conv2 ];

								// Otherwise, insert the intermediate dataType
								} else if ( converters[ conv2 ] !== true ) {
									current = tmp[ 0 ];
									dataTypes.unshift( tmp[ 1 ] );
								}
								break;
							}
						}
					}
				}

				// Apply converter (if not an equivalence)
				if ( conv !== true ) {

					// Unless errors are allowed to bubble, catch and return them
					if ( conv && s.throws ) {
						response = conv( response );
					} else {
						try {
							response = conv( response );
						} catch ( e ) {
							return {
								state: "parsererror",
								error: conv ? e : "No conversion from " + prev + " to " + current
							};
						}
					}
				}
			}
		}
	}

	return { state: "success", data: response };
}

jQuery.extend( {

	// Counter for holding the number of active queries
	active: 0,

	// Last-Modified header cache for next request
	lastModified: {},
	etag: {},

	ajaxSettings: {
		url: location.href,
		type: "GET",
		isLocal: rlocalProtocol.test( location.protocol ),
		global: true,
		processData: true,
		async: true,
		contentType: "application/x-www-form-urlencoded; charset=UTF-8",

		/*
		timeout: 0,
		data: null,
		dataType: null,
		username: null,
		password: null,
		cache: null,
		throws: false,
		traditional: false,
		headers: {},
		*/

		accepts: {
			"*": allTypes,
			text: "text/plain",
			html: "text/html",
			xml: "application/xml, text/xml",
			json: "application/json, text/javascript"
		},

		contents: {
			xml: /\bxml\b/,
			html: /\bhtml/,
			json: /\bjson\b/
		},

		responseFields: {
			xml: "responseXML",
			text: "responseText",
			json: "responseJSON"
		},

		// Data converters
		// Keys separate source (or catchall "*") and destination types with a single space
		converters: {

			// Convert anything to text
			"* text": String,

			// Text to html (true = no transformation)
			"text html": true,

			// Evaluate text as a json expression
			"text json": JSON.parse,

			// Parse text as xml
			"text xml": jQuery.parseXML
		},

		// For options that shouldn't be deep extended:
		// you can add your own custom options here if
		// and when you create one that shouldn't be
		// deep extended (see ajaxExtend)
		flatOptions: {
			url: true,
			context: true
		}
	},

	// Creates a full fledged settings object into target
	// with both ajaxSettings and settings fields.
	// If target is omitted, writes into ajaxSettings.
	ajaxSetup: function( target, settings ) {
		return settings ?

			// Building a settings object
			ajaxExtend( ajaxExtend( target, jQuery.ajaxSettings ), settings ) :

			// Extending ajaxSettings
			ajaxExtend( jQuery.ajaxSettings, target );
	},

	ajaxPrefilter: addToPrefiltersOrTransports( prefilters ),
	ajaxTransport: addToPrefiltersOrTransports( transports ),

	// Main method
	ajax: function( url, options ) {

		// If url is an object, simulate pre-1.5 signature
		if ( typeof url === "object" ) {
			options = url;
			url = undefined;
		}

		// Force options to be an object
		options = options || {};

		var transport,

			// URL without anti-cache param
			cacheURL,

			// Response headers
			responseHeadersString,
			responseHeaders,

			// timeout handle
			timeoutTimer,

			// Url cleanup var
			urlAnchor,

			// Request state (becomes false upon send and true upon completion)
			completed,

			// To know if global events are to be dispatched
			fireGlobals,

			// Loop variable
			i,

			// uncached part of the url
			uncached,

			// Create the final options object
			s = jQuery.ajaxSetup( {}, options ),

			// Callbacks context
			callbackContext = s.context || s,

			// Context for global events is callbackContext if it is a DOM node or jQuery collection
			globalEventContext = s.context &&
				( callbackContext.nodeType || callbackContext.jquery ) ?
					jQuery( callbackContext ) :
					jQuery.event,

			// Deferreds
			deferred = jQuery.Deferred(),
			completeDeferred = jQuery.Callbacks( "once memory" ),

			// Status-dependent callbacks
			statusCode = s.statusCode || {},

			// Headers (they are sent all at once)
			requestHeaders = {},
			requestHeadersNames = {},

			// Default abort message
			strAbort = "canceled",

			// Fake xhr
			jqXHR = {
				readyState: 0,

				// Builds headers hashtable if needed
				getResponseHeader: function( key ) {
					var match;
					if ( completed ) {
						if ( !responseHeaders ) {
							responseHeaders = {};
							while ( ( match = rheaders.exec( responseHeadersString ) ) ) {
								responseHeaders[ match[ 1 ].toLowerCase() + " " ] =
									( responseHeaders[ match[ 1 ].toLowerCase() + " " ] || [] )
										.concat( match[ 2 ] );
							}
						}
						match = responseHeaders[ key.toLowerCase() + " " ];
					}
					return match == null ? null : match.join( ", " );
				},

				// Raw string
				getAllResponseHeaders: function() {
					return completed ? responseHeadersString : null;
				},

				// Caches the header
				setRequestHeader: function( name, value ) {
					if ( completed == null ) {
						name = requestHeadersNames[ name.toLowerCase() ] =
							requestHeadersNames[ name.toLowerCase() ] || name;
						requestHeaders[ name ] = value;
					}
					return this;
				},

				// Overrides response content-type header
				overrideMimeType: function( type ) {
					if ( completed == null ) {
						s.mimeType = type;
					}
					return this;
				},

				// Status-dependent callbacks
				statusCode: function( map ) {
					var code;
					if ( map ) {
						if ( completed ) {

							// Execute the appropriate callbacks
							jqXHR.always( map[ jqXHR.status ] );
						} else {

							// Lazy-add the new callbacks in a way that preserves old ones
							for ( code in map ) {
								statusCode[ code ] = [ statusCode[ code ], map[ code ] ];
							}
						}
					}
					return this;
				},

				// Cancel the request
				abort: function( statusText ) {
					var finalText = statusText || strAbort;
					if ( transport ) {
						transport.abort( finalText );
					}
					done( 0, finalText );
					return this;
				}
			};

		// Attach deferreds
		deferred.promise( jqXHR );

		// Add protocol if not provided (prefilters might expect it)
		// Handle falsy url in the settings object (#10093: consistency with old signature)
		// We also use the url parameter if available
		s.url = ( ( url || s.url || location.href ) + "" )
			.replace( rprotocol, location.protocol + "//" );

		// Alias method option to type as per ticket #12004
		s.type = options.method || options.type || s.method || s.type;

		// Extract dataTypes list
		s.dataTypes = ( s.dataType || "*" ).toLowerCase().match( rnothtmlwhite ) || [ "" ];

		// A cross-domain request is in order when the origin doesn't match the current origin.
		if ( s.crossDomain == null ) {
			urlAnchor = document.createElement( "a" );

			// Support: IE <=8 - 11, Edge 12 - 15
			// IE throws exception on accessing the href property if url is malformed,
			// e.g. http://example.com:80x/
			try {
				urlAnchor.href = s.url;

				// Support: IE <=8 - 11 only
				// Anchor's host property isn't correctly set when s.url is relative
				urlAnchor.href = urlAnchor.href;
				s.crossDomain = originAnchor.protocol + "//" + originAnchor.host !==
					urlAnchor.protocol + "//" + urlAnchor.host;
			} catch ( e ) {

				// If there is an error parsing the URL, assume it is crossDomain,
				// it can be rejected by the transport if it is invalid
				s.crossDomain = true;
			}
		}

		// Convert data if not already a string
		if ( s.data && s.processData && typeof s.data !== "string" ) {
			s.data = jQuery.param( s.data, s.traditional );
		}

		// Apply prefilters
		inspectPrefiltersOrTransports( prefilters, s, options, jqXHR );

		// If request was aborted inside a prefilter, stop there
		if ( completed ) {
			return jqXHR;
		}

		// We can fire global events as of now if asked to
		// Don't fire events if jQuery.event is undefined in an AMD-usage scenario (#15118)
		fireGlobals = jQuery.event && s.global;

		// Watch for a new set of requests
		if ( fireGlobals && jQuery.active++ === 0 ) {
			jQuery.event.trigger( "ajaxStart" );
		}

		// Uppercase the type
		s.type = s.type.toUpperCase();

		// Determine if request has content
		s.hasContent = !rnoContent.test( s.type );

		// Save the URL in case we're toying with the If-Modified-Since
		// and/or If-None-Match header later on
		// Remove hash to simplify url manipulation
		cacheURL = s.url.replace( rhash, "" );

		// More options handling for requests with no content
		if ( !s.hasContent ) {

			// Remember the hash so we can put it back
			uncached = s.url.slice( cacheURL.length );

			// If data is available and should be processed, append data to url
			if ( s.data && ( s.processData || typeof s.data === "string" ) ) {
				cacheURL += ( rquery.test( cacheURL ) ? "&" : "?" ) + s.data;

				// #9682: remove data so that it's not used in an eventual retry
				delete s.data;
			}

			// Add or update anti-cache param if needed
			if ( s.cache === false ) {
				cacheURL = cacheURL.replace( rantiCache, "$1" );
				uncached = ( rquery.test( cacheURL ) ? "&" : "?" ) + "_=" + ( nonce++ ) + uncached;
			}

			// Put hash and anti-cache on the URL that will be requested (gh-1732)
			s.url = cacheURL + uncached;

		// Change '%20' to '+' if this is encoded form body content (gh-2658)
		} else if ( s.data && s.processData &&
			( s.contentType || "" ).indexOf( "application/x-www-form-urlencoded" ) === 0 ) {
			s.data = s.data.replace( r20, "+" );
		}

		// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
		if ( s.ifModified ) {
			if ( jQuery.lastModified[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-Modified-Since", jQuery.lastModified[ cacheURL ] );
			}
			if ( jQuery.etag[ cacheURL ] ) {
				jqXHR.setRequestHeader( "If-None-Match", jQuery.etag[ cacheURL ] );
			}
		}

		// Set the correct header, if data is being sent
		if ( s.data && s.hasContent && s.contentType !== false || options.contentType ) {
			jqXHR.setRequestHeader( "Content-Type", s.contentType );
		}

		// Set the Accepts header for the server, depending on the dataType
		jqXHR.setRequestHeader(
			"Accept",
			s.dataTypes[ 0 ] && s.accepts[ s.dataTypes[ 0 ] ] ?
				s.accepts[ s.dataTypes[ 0 ] ] +
					( s.dataTypes[ 0 ] !== "*" ? ", " + allTypes + "; q=0.01" : "" ) :
				s.accepts[ "*" ]
		);

		// Check for headers option
		for ( i in s.headers ) {
			jqXHR.setRequestHeader( i, s.headers[ i ] );
		}

		// Allow custom headers/mimetypes and early abort
		if ( s.beforeSend &&
			( s.beforeSend.call( callbackContext, jqXHR, s ) === false || completed ) ) {

			// Abort if not done already and return
			return jqXHR.abort();
		}

		// Aborting is no longer a cancellation
		strAbort = "abort";

		// Install callbacks on deferreds
		completeDeferred.add( s.complete );
		jqXHR.done( s.success );
		jqXHR.fail( s.error );

		// Get transport
		transport = inspectPrefiltersOrTransports( transports, s, options, jqXHR );

		// If no transport, we auto-abort
		if ( !transport ) {
			done( -1, "No Transport" );
		} else {
			jqXHR.readyState = 1;

			// Send global event
			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxSend", [ jqXHR, s ] );
			}

			// If request was aborted inside ajaxSend, stop there
			if ( completed ) {
				return jqXHR;
			}

			// Timeout
			if ( s.async && s.timeout > 0 ) {
				timeoutTimer = window.setTimeout( function() {
					jqXHR.abort( "timeout" );
				}, s.timeout );
			}

			try {
				completed = false;
				transport.send( requestHeaders, done );
			} catch ( e ) {

				// Rethrow post-completion exceptions
				if ( completed ) {
					throw e;
				}

				// Propagate others as results
				done( -1, e );
			}
		}

		// Callback for when everything is done
		function done( status, nativeStatusText, responses, headers ) {
			var isSuccess, success, error, response, modified,
				statusText = nativeStatusText;

			// Ignore repeat invocations
			if ( completed ) {
				return;
			}

			completed = true;

			// Clear timeout if it exists
			if ( timeoutTimer ) {
				window.clearTimeout( timeoutTimer );
			}

			// Dereference transport for early garbage collection
			// (no matter how long the jqXHR object will be used)
			transport = undefined;

			// Cache response headers
			responseHeadersString = headers || "";

			// Set readyState
			jqXHR.readyState = status > 0 ? 4 : 0;

			// Determine if successful
			isSuccess = status >= 200 && status < 300 || status === 304;

			// Get response data
			if ( responses ) {
				response = ajaxHandleResponses( s, jqXHR, responses );
			}

			// Convert no matter what (that way responseXXX fields are always set)
			response = ajaxConvert( s, response, jqXHR, isSuccess );

			// If successful, handle type chaining
			if ( isSuccess ) {

				// Set the If-Modified-Since and/or If-None-Match header, if in ifModified mode.
				if ( s.ifModified ) {
					modified = jqXHR.getResponseHeader( "Last-Modified" );
					if ( modified ) {
						jQuery.lastModified[ cacheURL ] = modified;
					}
					modified = jqXHR.getResponseHeader( "etag" );
					if ( modified ) {
						jQuery.etag[ cacheURL ] = modified;
					}
				}

				// if no content
				if ( status === 204 || s.type === "HEAD" ) {
					statusText = "nocontent";

				// if not modified
				} else if ( status === 304 ) {
					statusText = "notmodified";

				// If we have data, let's convert it
				} else {
					statusText = response.state;
					success = response.data;
					error = response.error;
					isSuccess = !error;
				}
			} else {

				// Extract error from statusText and normalize for non-aborts
				error = statusText;
				if ( status || !statusText ) {
					statusText = "error";
					if ( status < 0 ) {
						status = 0;
					}
				}
			}

			// Set data for the fake xhr object
			jqXHR.status = status;
			jqXHR.statusText = ( nativeStatusText || statusText ) + "";

			// Success/Error
			if ( isSuccess ) {
				deferred.resolveWith( callbackContext, [ success, statusText, jqXHR ] );
			} else {
				deferred.rejectWith( callbackContext, [ jqXHR, statusText, error ] );
			}

			// Status-dependent callbacks
			jqXHR.statusCode( statusCode );
			statusCode = undefined;

			if ( fireGlobals ) {
				globalEventContext.trigger( isSuccess ? "ajaxSuccess" : "ajaxError",
					[ jqXHR, s, isSuccess ? success : error ] );
			}

			// Complete
			completeDeferred.fireWith( callbackContext, [ jqXHR, statusText ] );

			if ( fireGlobals ) {
				globalEventContext.trigger( "ajaxComplete", [ jqXHR, s ] );

				// Handle the global AJAX counter
				if ( !( --jQuery.active ) ) {
					jQuery.event.trigger( "ajaxStop" );
				}
			}
		}

		return jqXHR;
	},

	getJSON: function( url, data, callback ) {
		return jQuery.get( url, data, callback, "json" );
	},

	getScript: function( url, callback ) {
		return jQuery.get( url, undefined, callback, "script" );
	}
} );

jQuery.each( [ "get", "post" ], function( i, method ) {
	jQuery[ method ] = function( url, data, callback, type ) {

		// Shift arguments if data argument was omitted
		if ( isFunction( data ) ) {
			type = type || callback;
			callback = data;
			data = undefined;
		}

		// The url can be an options object (which then must have .url)
		return jQuery.ajax( jQuery.extend( {
			url: url,
			type: method,
			dataType: type,
			data: data,
			success: callback
		}, jQuery.isPlainObject( url ) && url ) );
	};
} );


jQuery._evalUrl = function( url, options ) {
	return jQuery.ajax( {
		url: url,

		// Make this explicit, since user can override this through ajaxSetup (#11264)
		type: "GET",
		dataType: "script",
		cache: true,
		async: false,
		global: false,

		// Only evaluate the response if it is successful (gh-4126)
		// dataFilter is not invoked for failure responses, so using it instead
		// of the default converter is kludgy but it works.
		converters: {
			"text script": function() {}
		},
		dataFilter: function( response ) {
			jQuery.globalEval( response, options );
		}
	} );
};


jQuery.fn.extend( {
	wrapAll: function( html ) {
		var wrap;

		if ( this[ 0 ] ) {
			if ( isFunction( html ) ) {
				html = html.call( this[ 0 ] );
			}

			// The elements to wrap the target around
			wrap = jQuery( html, this[ 0 ].ownerDocument ).eq( 0 ).clone( true );

			if ( this[ 0 ].parentNode ) {
				wrap.insertBefore( this[ 0 ] );
			}

			wrap.map( function() {
				var elem = this;

				while ( elem.firstElementChild ) {
					elem = elem.firstElementChild;
				}

				return elem;
			} ).append( this );
		}

		return this;
	},

	wrapInner: function( html ) {
		if ( isFunction( html ) ) {
			return this.each( function( i ) {
				jQuery( this ).wrapInner( html.call( this, i ) );
			} );
		}

		return this.each( function() {
			var self = jQuery( this ),
				contents = self.contents();

			if ( contents.length ) {
				contents.wrapAll( html );

			} else {
				self.append( html );
			}
		} );
	},

	wrap: function( html ) {
		var htmlIsFunction = isFunction( html );

		return this.each( function( i ) {
			jQuery( this ).wrapAll( htmlIsFunction ? html.call( this, i ) : html );
		} );
	},

	unwrap: function( selector ) {
		this.parent( selector ).not( "body" ).each( function() {
			jQuery( this ).replaceWith( this.childNodes );
		} );
		return this;
	}
} );


jQuery.expr.pseudos.hidden = function( elem ) {
	return !jQuery.expr.pseudos.visible( elem );
};
jQuery.expr.pseudos.visible = function( elem ) {
	return !!( elem.offsetWidth || elem.offsetHeight || elem.getClientRects().length );
};




jQuery.ajaxSettings.xhr = function() {
	try {
		return new window.XMLHttpRequest();
	} catch ( e ) {}
};

var xhrSuccessStatus = {

		// File protocol always yields status code 0, assume 200
		0: 200,

		// Support: IE <=9 only
		// #1450: sometimes IE returns 1223 when it should be 204
		1223: 204
	},
	xhrSupported = jQuery.ajaxSettings.xhr();

support.cors = !!xhrSupported && ( "withCredentials" in xhrSupported );
support.ajax = xhrSupported = !!xhrSupported;

jQuery.ajaxTransport( function( options ) {
	var callback, errorCallback;

	// Cross domain only allowed if supported through XMLHttpRequest
	if ( support.cors || xhrSupported && !options.crossDomain ) {
		return {
			send: function( headers, complete ) {
				var i,
					xhr = options.xhr();

				xhr.open(
					options.type,
					options.url,
					options.async,
					options.username,
					options.password
				);

				// Apply custom fields if provided
				if ( options.xhrFields ) {
					for ( i in options.xhrFields ) {
						xhr[ i ] = options.xhrFields[ i ];
					}
				}

				// Override mime type if needed
				if ( options.mimeType && xhr.overrideMimeType ) {
					xhr.overrideMimeType( options.mimeType );
				}

				// X-Requested-With header
				// For cross-domain requests, seeing as conditions for a preflight are
				// akin to a jigsaw puzzle, we simply never set it to be sure.
				// (it can always be set on a per-request basis or even using ajaxSetup)
				// For same-domain requests, won't change header if already provided.
				if ( !options.crossDomain && !headers[ "X-Requested-With" ] ) {
					headers[ "X-Requested-With" ] = "XMLHttpRequest";
				}

				// Set headers
				for ( i in headers ) {
					xhr.setRequestHeader( i, headers[ i ] );
				}

				// Callback
				callback = function( type ) {
					return function() {
						if ( callback ) {
							callback = errorCallback = xhr.onload =
								xhr.onerror = xhr.onabort = xhr.ontimeout =
									xhr.onreadystatechange = null;

							if ( type === "abort" ) {
								xhr.abort();
							} else if ( type === "error" ) {

								// Support: IE <=9 only
								// On a manual native abort, IE9 throws
								// errors on any property access that is not readyState
								if ( typeof xhr.status !== "number" ) {
									complete( 0, "error" );
								} else {
									complete(

										// File: protocol always yields status 0; see #8605, #14207
										xhr.status,
										xhr.statusText
									);
								}
							} else {
								complete(
									xhrSuccessStatus[ xhr.status ] || xhr.status,
									xhr.statusText,

									// Support: IE <=9 only
									// IE9 has no XHR2 but throws on binary (trac-11426)
									// For XHR2 non-text, let the caller handle it (gh-2498)
									( xhr.responseType || "text" ) !== "text"  ||
									typeof xhr.responseText !== "string" ?
										{ binary: xhr.response } :
										{ text: xhr.responseText },
									xhr.getAllResponseHeaders()
								);
							}
						}
					};
				};

				// Listen to events
				xhr.onload = callback();
				errorCallback = xhr.onerror = xhr.ontimeout = callback( "error" );

				// Support: IE 9 only
				// Use onreadystatechange to replace onabort
				// to handle uncaught aborts
				if ( xhr.onabort !== undefined ) {
					xhr.onabort = errorCallback;
				} else {
					xhr.onreadystatechange = function() {

						// Check readyState before timeout as it changes
						if ( xhr.readyState === 4 ) {

							// Allow onerror to be called first,
							// but that will not handle a native abort
							// Also, save errorCallback to a variable
							// as xhr.onerror cannot be accessed
							window.setTimeout( function() {
								if ( callback ) {
									errorCallback();
								}
							} );
						}
					};
				}

				// Create the abort callback
				callback = callback( "abort" );

				try {

					// Do send the request (this may raise an exception)
					xhr.send( options.hasContent && options.data || null );
				} catch ( e ) {

					// #14683: Only rethrow if this hasn't been notified as an error yet
					if ( callback ) {
						throw e;
					}
				}
			},

			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
} );




// Prevent auto-execution of scripts when no explicit dataType was provided (See gh-2432)
jQuery.ajaxPrefilter( function( s ) {
	if ( s.crossDomain ) {
		s.contents.script = false;
	}
} );

// Install script dataType
jQuery.ajaxSetup( {
	accepts: {
		script: "text/javascript, application/javascript, " +
			"application/ecmascript, application/x-ecmascript"
	},
	contents: {
		script: /\b(?:java|ecma)script\b/
	},
	converters: {
		"text script": function( text ) {
			jQuery.globalEval( text );
			return text;
		}
	}
} );

// Handle cache's special case and crossDomain
jQuery.ajaxPrefilter( "script", function( s ) {
	if ( s.cache === undefined ) {
		s.cache = false;
	}
	if ( s.crossDomain ) {
		s.type = "GET";
	}
} );

// Bind script tag hack transport
jQuery.ajaxTransport( "script", function( s ) {

	// This transport only deals with cross domain or forced-by-attrs requests
	if ( s.crossDomain || s.scriptAttrs ) {
		var script, callback;
		return {
			send: function( _, complete ) {
				script = jQuery( "<script>" )
					.attr( s.scriptAttrs || {} )
					.prop( { charset: s.scriptCharset, src: s.url } )
					.on( "load error", callback = function( evt ) {
						script.remove();
						callback = null;
						if ( evt ) {
							complete( evt.type === "error" ? 404 : 200, evt.type );
						}
					} );

				// Use native DOM manipulation to avoid our domManip AJAX trickery
				document.head.appendChild( script[ 0 ] );
			},
			abort: function() {
				if ( callback ) {
					callback();
				}
			}
		};
	}
} );




var oldCallbacks = [],
	rjsonp = /(=)\?(?=&|$)|\?\?/;

// Default jsonp settings
jQuery.ajaxSetup( {
	jsonp: "callback",
	jsonpCallback: function() {
		var callback = oldCallbacks.pop() || ( jQuery.expando + "_" + ( nonce++ ) );
		this[ callback ] = true;
		return callback;
	}
} );

// Detect, normalize options and install callbacks for jsonp requests
jQuery.ajaxPrefilter( "json jsonp", function( s, originalSettings, jqXHR ) {

	var callbackName, overwritten, responseContainer,
		jsonProp = s.jsonp !== false && ( rjsonp.test( s.url ) ?
			"url" :
			typeof s.data === "string" &&
				( s.contentType || "" )
					.indexOf( "application/x-www-form-urlencoded" ) === 0 &&
				rjsonp.test( s.data ) && "data"
		);

	// Handle iff the expected data type is "jsonp" or we have a parameter to set
	if ( jsonProp || s.dataTypes[ 0 ] === "jsonp" ) {

		// Get callback name, remembering preexisting value associated with it
		callbackName = s.jsonpCallback = isFunction( s.jsonpCallback ) ?
			s.jsonpCallback() :
			s.jsonpCallback;

		// Insert callback into url or form data
		if ( jsonProp ) {
			s[ jsonProp ] = s[ jsonProp ].replace( rjsonp, "$1" + callbackName );
		} else if ( s.jsonp !== false ) {
			s.url += ( rquery.test( s.url ) ? "&" : "?" ) + s.jsonp + "=" + callbackName;
		}

		// Use data converter to retrieve json after script execution
		s.converters[ "script json" ] = function() {
			if ( !responseContainer ) {
				jQuery.error( callbackName + " was not called" );
			}
			return responseContainer[ 0 ];
		};

		// Force json dataType
		s.dataTypes[ 0 ] = "json";

		// Install callback
		overwritten = window[ callbackName ];
		window[ callbackName ] = function() {
			responseContainer = arguments;
		};

		// Clean-up function (fires after converters)
		jqXHR.always( function() {

			// If previous value didn't exist - remove it
			if ( overwritten === undefined ) {
				jQuery( window ).removeProp( callbackName );

			// Otherwise restore preexisting value
			} else {
				window[ callbackName ] = overwritten;
			}

			// Save back as free
			if ( s[ callbackName ] ) {

				// Make sure that re-using the options doesn't screw things around
				s.jsonpCallback = originalSettings.jsonpCallback;

				// Save the callback name for future use
				oldCallbacks.push( callbackName );
			}

			// Call if it was a function and we have a response
			if ( responseContainer && isFunction( overwritten ) ) {
				overwritten( responseContainer[ 0 ] );
			}

			responseContainer = overwritten = undefined;
		} );

		// Delegate to script
		return "script";
	}
} );




// Support: Safari 8 only
// In Safari 8 documents created via document.implementation.createHTMLDocument
// collapse sibling forms: the second one becomes a child of the first one.
// Because of that, this security measure has to be disabled in Safari 8.
// https://bugs.webkit.org/show_bug.cgi?id=137337
support.createHTMLDocument = ( function() {
	var body = document.implementation.createHTMLDocument( "" ).body;
	body.innerHTML = "<form></form><form></form>";
	return body.childNodes.length === 2;
} )();


// Argument "data" should be string of html
// context (optional): If specified, the fragment will be created in this context,
// defaults to document
// keepScripts (optional): If true, will include scripts passed in the html string
jQuery.parseHTML = function( data, context, keepScripts ) {
	if ( typeof data !== "string" ) {
		return [];
	}
	if ( typeof context === "boolean" ) {
		keepScripts = context;
		context = false;
	}

	var base, parsed, scripts;

	if ( !context ) {

		// Stop scripts or inline event handlers from being executed immediately
		// by using document.implementation
		if ( support.createHTMLDocument ) {
			context = document.implementation.createHTMLDocument( "" );

			// Set the base href for the created document
			// so any parsed elements with URLs
			// are based on the document's URL (gh-2965)
			base = context.createElement( "base" );
			base.href = document.location.href;
			context.head.appendChild( base );
		} else {
			context = document;
		}
	}

	parsed = rsingleTag.exec( data );
	scripts = !keepScripts && [];

	// Single tag
	if ( parsed ) {
		return [ context.createElement( parsed[ 1 ] ) ];
	}

	parsed = buildFragment( [ data ], context, scripts );

	if ( scripts && scripts.length ) {
		jQuery( scripts ).remove();
	}

	return jQuery.merge( [], parsed.childNodes );
};


/**
 * Load a url into a page
 */
jQuery.fn.load = function( url, params, callback ) {
	var selector, type, response,
		self = this,
		off = url.indexOf( " " );

	if ( off > -1 ) {
		selector = stripAndCollapse( url.slice( off ) );
		url = url.slice( 0, off );
	}

	// If it's a function
	if ( isFunction( params ) ) {

		// We assume that it's the callback
		callback = params;
		params = undefined;

	// Otherwise, build a param string
	} else if ( params && typeof params === "object" ) {
		type = "POST";
	}

	// If we have elements to modify, make the request
	if ( self.length > 0 ) {
		jQuery.ajax( {
			url: url,

			// If "type" variable is undefined, then "GET" method will be used.
			// Make value of this field explicit since
			// user can override it through ajaxSetup method
			type: type || "GET",
			dataType: "html",
			data: params
		} ).done( function( responseText ) {

			// Save response for use in complete callback
			response = arguments;

			self.html( selector ?

				// If a selector was specified, locate the right elements in a dummy div
				// Exclude scripts to avoid IE 'Permission Denied' errors
				jQuery( "<div>" ).append( jQuery.parseHTML( responseText ) ).find( selector ) :

				// Otherwise use the full result
				responseText );

		// If the request succeeds, this function gets "data", "status", "jqXHR"
		// but they are ignored because response was set above.
		// If it fails, this function gets "jqXHR", "status", "error"
		} ).always( callback && function( jqXHR, status ) {
			self.each( function() {
				callback.apply( this, response || [ jqXHR.responseText, status, jqXHR ] );
			} );
		} );
	}

	return this;
};




// Attach a bunch of functions for handling common AJAX events
jQuery.each( [
	"ajaxStart",
	"ajaxStop",
	"ajaxComplete",
	"ajaxError",
	"ajaxSuccess",
	"ajaxSend"
], function( i, type ) {
	jQuery.fn[ type ] = function( fn ) {
		return this.on( type, fn );
	};
} );




jQuery.expr.pseudos.animated = function( elem ) {
	return jQuery.grep( jQuery.timers, function( fn ) {
		return elem === fn.elem;
	} ).length;
};




jQuery.offset = {
	setOffset: function( elem, options, i ) {
		var curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
			position = jQuery.css( elem, "position" ),
			curElem = jQuery( elem ),
			props = {};

		// Set position first, in-case top/left are set even on static elem
		if ( position === "static" ) {
			elem.style.position = "relative";
		}

		curOffset = curElem.offset();
		curCSSTop = jQuery.css( elem, "top" );
		curCSSLeft = jQuery.css( elem, "left" );
		calculatePosition = ( position === "absolute" || position === "fixed" ) &&
			( curCSSTop + curCSSLeft ).indexOf( "auto" ) > -1;

		// Need to be able to calculate position if either
		// top or left is auto and position is either absolute or fixed
		if ( calculatePosition ) {
			curPosition = curElem.position();
			curTop = curPosition.top;
			curLeft = curPosition.left;

		} else {
			curTop = parseFloat( curCSSTop ) || 0;
			curLeft = parseFloat( curCSSLeft ) || 0;
		}

		if ( isFunction( options ) ) {

			// Use jQuery.extend here to allow modification of coordinates argument (gh-1848)
			options = options.call( elem, i, jQuery.extend( {}, curOffset ) );
		}

		if ( options.top != null ) {
			props.top = ( options.top - curOffset.top ) + curTop;
		}
		if ( options.left != null ) {
			props.left = ( options.left - curOffset.left ) + curLeft;
		}

		if ( "using" in options ) {
			options.using.call( elem, props );

		} else {
			curElem.css( props );
		}
	}
};

jQuery.fn.extend( {

	// offset() relates an element's border box to the document origin
	offset: function( options ) {

		// Preserve chaining for setter
		if ( arguments.length ) {
			return options === undefined ?
				this :
				this.each( function( i ) {
					jQuery.offset.setOffset( this, options, i );
				} );
		}

		var rect, win,
			elem = this[ 0 ];

		if ( !elem ) {
			return;
		}

		// Return zeros for disconnected and hidden (display: none) elements (gh-2310)
		// Support: IE <=11 only
		// Running getBoundingClientRect on a
		// disconnected node in IE throws an error
		if ( !elem.getClientRects().length ) {
			return { top: 0, left: 0 };
		}

		// Get document-relative position by adding viewport scroll to viewport-relative gBCR
		rect = elem.getBoundingClientRect();
		win = elem.ownerDocument.defaultView;
		return {
			top: rect.top + win.pageYOffset,
			left: rect.left + win.pageXOffset
		};
	},

	// position() relates an element's margin box to its offset parent's padding box
	// This corresponds to the behavior of CSS absolute positioning
	position: function() {
		if ( !this[ 0 ] ) {
			return;
		}

		var offsetParent, offset, doc,
			elem = this[ 0 ],
			parentOffset = { top: 0, left: 0 };

		// position:fixed elements are offset from the viewport, which itself always has zero offset
		if ( jQuery.css( elem, "position" ) === "fixed" ) {

			// Assume position:fixed implies availability of getBoundingClientRect
			offset = elem.getBoundingClientRect();

		} else {
			offset = this.offset();

			// Account for the *real* offset parent, which can be the document or its root element
			// when a statically positioned element is identified
			doc = elem.ownerDocument;
			offsetParent = elem.offsetParent || doc.documentElement;
			while ( offsetParent &&
				( offsetParent === doc.body || offsetParent === doc.documentElement ) &&
				jQuery.css( offsetParent, "position" ) === "static" ) {

				offsetParent = offsetParent.parentNode;
			}
			if ( offsetParent && offsetParent !== elem && offsetParent.nodeType === 1 ) {

				// Incorporate borders into its offset, since they are outside its content origin
				parentOffset = jQuery( offsetParent ).offset();
				parentOffset.top += jQuery.css( offsetParent, "borderTopWidth", true );
				parentOffset.left += jQuery.css( offsetParent, "borderLeftWidth", true );
			}
		}

		// Subtract parent offsets and element margins
		return {
			top: offset.top - parentOffset.top - jQuery.css( elem, "marginTop", true ),
			left: offset.left - parentOffset.left - jQuery.css( elem, "marginLeft", true )
		};
	},

	// This method will return documentElement in the following cases:
	// 1) For the element inside the iframe without offsetParent, this method will return
	//    documentElement of the parent window
	// 2) For the hidden or detached element
	// 3) For body or html element, i.e. in case of the html node - it will return itself
	//
	// but those exceptions were never presented as a real life use-cases
	// and might be considered as more preferable results.
	//
	// This logic, however, is not guaranteed and can change at any point in the future
	offsetParent: function() {
		return this.map( function() {
			var offsetParent = this.offsetParent;

			while ( offsetParent && jQuery.css( offsetParent, "position" ) === "static" ) {
				offsetParent = offsetParent.offsetParent;
			}

			return offsetParent || documentElement;
		} );
	}
} );

// Create scrollLeft and scrollTop methods
jQuery.each( { scrollLeft: "pageXOffset", scrollTop: "pageYOffset" }, function( method, prop ) {
	var top = "pageYOffset" === prop;

	jQuery.fn[ method ] = function( val ) {
		return access( this, function( elem, method, val ) {

			// Coalesce documents and windows
			var win;
			if ( isWindow( elem ) ) {
				win = elem;
			} else if ( elem.nodeType === 9 ) {
				win = elem.defaultView;
			}

			if ( val === undefined ) {
				return win ? win[ prop ] : elem[ method ];
			}

			if ( win ) {
				win.scrollTo(
					!top ? val : win.pageXOffset,
					top ? val : win.pageYOffset
				);

			} else {
				elem[ method ] = val;
			}
		}, method, val, arguments.length );
	};
} );

// Support: Safari <=7 - 9.1, Chrome <=37 - 49
// Add the top/left cssHooks using jQuery.fn.position
// Webkit bug: https://bugs.webkit.org/show_bug.cgi?id=29084
// Blink bug: https://bugs.chromium.org/p/chromium/issues/detail?id=589347
// getComputedStyle returns percent when specified for top/left/bottom/right;
// rather than make the css module depend on the offset module, just check for it here
jQuery.each( [ "top", "left" ], function( i, prop ) {
	jQuery.cssHooks[ prop ] = addGetHookIf( support.pixelPosition,
		function( elem, computed ) {
			if ( computed ) {
				computed = curCSS( elem, prop );

				// If curCSS returns percentage, fallback to offset
				return rnumnonpx.test( computed ) ?
					jQuery( elem ).position()[ prop ] + "px" :
					computed;
			}
		}
	);
} );


// Create innerHeight, innerWidth, height, width, outerHeight and outerWidth methods
jQuery.each( { Height: "height", Width: "width" }, function( name, type ) {
	jQuery.each( { padding: "inner" + name, content: type, "": "outer" + name },
		function( defaultExtra, funcName ) {

		// Margin is only for outerHeight, outerWidth
		jQuery.fn[ funcName ] = function( margin, value ) {
			var chainable = arguments.length && ( defaultExtra || typeof margin !== "boolean" ),
				extra = defaultExtra || ( margin === true || value === true ? "margin" : "border" );

			return access( this, function( elem, type, value ) {
				var doc;

				if ( isWindow( elem ) ) {

					// $( window ).outerWidth/Height return w/h including scrollbars (gh-1729)
					return funcName.indexOf( "outer" ) === 0 ?
						elem[ "inner" + name ] :
						elem.document.documentElement[ "client" + name ];
				}

				// Get document width or height
				if ( elem.nodeType === 9 ) {
					doc = elem.documentElement;

					// Either scroll[Width/Height] or offset[Width/Height] or client[Width/Height],
					// whichever is greatest
					return Math.max(
						elem.body[ "scroll" + name ], doc[ "scroll" + name ],
						elem.body[ "offset" + name ], doc[ "offset" + name ],
						doc[ "client" + name ]
					);
				}

				return value === undefined ?

					// Get width or height on the element, requesting but not forcing parseFloat
					jQuery.css( elem, type, extra ) :

					// Set width or height on the element
					jQuery.style( elem, type, value, extra );
			}, type, chainable ? margin : undefined, chainable );
		};
	} );
} );


jQuery.each( ( "blur focus focusin focusout resize scroll click dblclick " +
	"mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
	"change select submit keydown keypress keyup contextmenu" ).split( " " ),
	function( i, name ) {

	// Handle event binding
	jQuery.fn[ name ] = function( data, fn ) {
		return arguments.length > 0 ?
			this.on( name, null, data, fn ) :
			this.trigger( name );
	};
} );

jQuery.fn.extend( {
	hover: function( fnOver, fnOut ) {
		return this.mouseenter( fnOver ).mouseleave( fnOut || fnOver );
	}
} );




jQuery.fn.extend( {

	bind: function( types, data, fn ) {
		return this.on( types, null, data, fn );
	},
	unbind: function( types, fn ) {
		return this.off( types, null, fn );
	},

	delegate: function( selector, types, data, fn ) {
		return this.on( types, selector, data, fn );
	},
	undelegate: function( selector, types, fn ) {

		// ( namespace ) or ( selector, types [, fn] )
		return arguments.length === 1 ?
			this.off( selector, "**" ) :
			this.off( types, selector || "**", fn );
	}
} );

// Bind a function to a context, optionally partially applying any
// arguments.
// jQuery.proxy is deprecated to promote standards (specifically Function#bind)
// However, it is not slated for removal any time soon
jQuery.proxy = function( fn, context ) {
	var tmp, args, proxy;

	if ( typeof context === "string" ) {
		tmp = fn[ context ];
		context = fn;
		fn = tmp;
	}

	// Quick check to determine if target is callable, in the spec
	// this throws a TypeError, but we will just return undefined.
	if ( !isFunction( fn ) ) {
		return undefined;
	}

	// Simulated bind
	args = slice.call( arguments, 2 );
	proxy = function() {
		return fn.apply( context || this, args.concat( slice.call( arguments ) ) );
	};

	// Set the guid of unique handler to the same of original handler, so it can be removed
	proxy.guid = fn.guid = fn.guid || jQuery.guid++;

	return proxy;
};

jQuery.holdReady = function( hold ) {
	if ( hold ) {
		jQuery.readyWait++;
	} else {
		jQuery.ready( true );
	}
};
jQuery.isArray = Array.isArray;
jQuery.parseJSON = JSON.parse;
jQuery.nodeName = nodeName;
jQuery.isFunction = isFunction;
jQuery.isWindow = isWindow;
jQuery.camelCase = camelCase;
jQuery.type = toType;

jQuery.now = Date.now;

jQuery.isNumeric = function( obj ) {

	// As of jQuery 3.0, isNumeric is limited to
	// strings and numbers (primitives or objects)
	// that can be coerced to finite numbers (gh-2662)
	var type = jQuery.type( obj );
	return ( type === "number" || type === "string" ) &&

		// parseFloat NaNs numeric-cast false positives ("")
		// ...but misinterprets leading-number strings, particularly hex literals ("0x...")
		// subtraction forces infinities to NaN
		!isNaN( obj - parseFloat( obj ) );
};




// Register as a named AMD module, since jQuery can be concatenated with other
// files that may use define, but not via a proper concatenation script that
// understands anonymous AMD modules. A named AMD is safest and most robust
// way to register. Lowercase jquery is used because AMD module names are
// derived from file names, and jQuery is normally delivered in a lowercase
// file name. Do this after creating the global so that if an AMD module wants
// to call noConflict to hide this version of jQuery, it will work.

// Note that for maximum portability, libraries that are not jQuery should
// declare themselves as anonymous modules, and avoid setting a global if an
// AMD loader is present. jQuery is a special case. For more information, see
// https://github.com/jrburke/requirejs/wiki/Updating-existing-libraries#wiki-anon

if ( typeof define === "function" && define.amd ) {
	define( "jquery", [], function() {
		return jQuery;
	} );
}




var

	// Map over jQuery in case of overwrite
	_jQuery = window.jQuery,

	// Map over the $ in case of overwrite
	_$ = window.$;

jQuery.noConflict = function( deep ) {
	if ( window.$ === jQuery ) {
		window.$ = _$;
	}

	if ( deep && window.jQuery === jQuery ) {
		window.jQuery = _jQuery;
	}

	return jQuery;
};

// Expose jQuery and $ identifiers, even in AMD
// (#7102#comment:10, https://github.com/jquery/jquery/pull/557)
// and CommonJS for browser emulators (#13566)
if ( !noGlobal ) {
	window.jQuery = window.$ = jQuery;
}




return jQuery;
} );

/*! jQuery Migrate v3.0.1 | (c) jQuery Foundation and other contributors | jquery.org/license */

void 0 === jQuery.migrateMute && (jQuery.migrateMute = !0), function(e) {
    "function" == typeof define && define.amd ? define([ "jquery" ], window, e) : "object" == typeof module && module.exports ? module.exports = e(require("jquery"), window) : e(jQuery, window);
}(function(e, t) {
    "use strict";
    function r(r) {
        var n = t.console;
        o[r] || (o[r] = !0, e.migrateWarnings.push(r), n && n.warn && !e.migrateMute && (n.warn("JQMIGRATE: " + r), 
        e.migrateTrace && n.trace && n.trace()));
    }
    function n(e, t, n, a) {
        Object.defineProperty(e, t, {
            configurable: !0,
            enumerable: !0,
            get: function() {
                return r(a), n;
            },
            set: function(e) {
                r(a), n = e;
            }
        });
    }
    function a(e, t, n, a) {
        e[t] = function() {
            return r(a), n.apply(this, arguments);
        };
    }
    e.migrateVersion = "3.0.1", function() {
        var r = /^[12]\./;
        t.console && t.console.log && (e && !r.test(e.fn.jquery) || t.console.log("JQMIGRATE: jQuery 3.0.0+ REQUIRED"), 
        e.migrateWarnings && t.console.log("JQMIGRATE: Migrate plugin loaded multiple times"), 
        t.console.log("JQMIGRATE: Migrate is installed" + (e.migrateMute ? "" : " with logging active") + ", version " + e.migrateVersion));
    }();
    var o = {};
    e.migrateWarnings = [], void 0 === e.migrateTrace && (e.migrateTrace = !0), e.migrateReset = function() {
        o = {}, e.migrateWarnings.length = 0;
    }, "BackCompat" === t.document.compatMode && r("jQuery is not compatible with Quirks Mode");
    var i = e.fn.init, s = e.isNumeric, u = e.find, c = /\[(\s*[-\w]+\s*)([~|^$*]?=)\s*([-\w#]*?#[-\w#]*)\s*\]/, l = /\[(\s*[-\w]+\s*)([~|^$*]?=)\s*([-\w#]*?#[-\w#]*)\s*\]/g;
    e.fn.init = function(e) {
        var t = Array.prototype.slice.call(arguments);
        return "string" == typeof e && "#" === e && (r("jQuery( '#' ) is not a valid selector"), 
        t[0] = []), i.apply(this, t);
    }, e.fn.init.prototype = e.fn, e.find = function(e) {
        var n = Array.prototype.slice.call(arguments);
        if ("string" == typeof e && c.test(e)) try {
            t.document.querySelector(e);
        } catch (a) {
            e = e.replace(l, function(e, t, r, n) {
                return "[" + t + r + '"' + n + '"]';
            });
            try {
                t.document.querySelector(e), r("Attribute selector with '#' must be quoted: " + n[0]), 
                n[0] = e;
            } catch (e) {
                r("Attribute selector with '#' was not fixed: " + n[0]);
            }
        }
        return u.apply(this, n);
    };
    var d;
    for (d in u) Object.prototype.hasOwnProperty.call(u, d) && (e.find[d] = u[d]);
    e.fn.size = function() {
        return r("jQuery.fn.size() is deprecated and removed; use the .length property"), 
        this.length;
    }, e.parseJSON = function() {
        return r("jQuery.parseJSON is deprecated; use JSON.parse"), JSON.parse.apply(null, arguments);
    }, e.isNumeric = function(t) {
        var n = s(t), a = function(t) {
            var r = t && t.toString();
            return !e.isArray(t) && r - parseFloat(r) + 1 >= 0;
        }(t);
        return n !== a && r("jQuery.isNumeric() should not be called on constructed objects"), 
        a;
    }, a(e, "holdReady", e.holdReady, "jQuery.holdReady is deprecated"), a(e, "unique", e.uniqueSort, "jQuery.unique is deprecated; use jQuery.uniqueSort"), 
    n(e.expr, "filters", e.expr.pseudos, "jQuery.expr.filters is deprecated; use jQuery.expr.pseudos"), 
    n(e.expr, ":", e.expr.pseudos, "jQuery.expr[':'] is deprecated; use jQuery.expr.pseudos");
    var p = e.ajax;
    e.ajax = function() {
        var e = p.apply(this, arguments);
        return e.promise && (a(e, "success", e.done, "jQXHR.success is deprecated and removed"), 
        a(e, "error", e.fail, "jQXHR.error is deprecated and removed"), a(e, "complete", e.always, "jQXHR.complete is deprecated and removed")), 
        e;
    };
    var f = e.fn.removeAttr, y = e.fn.toggleClass, m = /\S+/g;
    e.fn.removeAttr = function(t) {
        var n = this;
        return e.each(t.match(m), function(t, a) {
            e.expr.match.bool.test(a) && (r("jQuery.fn.removeAttr no longer sets boolean properties: " + a), 
            n.prop(a, !1));
        }), f.apply(this, arguments);
    }, e.fn.toggleClass = function(t) {
        return void 0 !== t && "boolean" != typeof t ? y.apply(this, arguments) : (r("jQuery.fn.toggleClass( boolean ) is deprecated"), 
        this.each(function() {
            var r = this.getAttribute && this.getAttribute("class") || "";
            r && e.data(this, "__className__", r), this.setAttribute && this.setAttribute("class", r || !1 === t ? "" : e.data(this, "__className__") || "");
        }));
    };
    var h = !1;
    e.swap && e.each([ "height", "width", "reliableMarginRight" ], function(t, r) {
        var n = e.cssHooks[r] && e.cssHooks[r].get;
        n && (e.cssHooks[r].get = function() {
            var e;
            return h = !0, e = n.apply(this, arguments), h = !1, e;
        });
    }), e.swap = function(e, t, n, a) {
        var o, i, s = {};
        h || r("jQuery.swap() is undocumented and deprecated");
        for (i in t) s[i] = e.style[i], e.style[i] = t[i];
        o = n.apply(e, a || []);
        for (i in t) e.style[i] = s[i];
        return o;
    };
    var g = e.data;
    e.data = function(t, n, a) {
        var o;
        if (n && "object" == typeof n && 2 === arguments.length) {
            o = e.hasData(t) && g.call(this, t);
            var i = {};
            for (var s in n) s !== e.camelCase(s) ? (r("jQuery.data() always sets/gets camelCased names: " + s), 
            o[s] = n[s]) : i[s] = n[s];
            return g.call(this, t, i), n;
        }
        return n && "string" == typeof n && n !== e.camelCase(n) && (o = e.hasData(t) && g.call(this, t)) && n in o ? (r("jQuery.data() always sets/gets camelCased names: " + n), 
        arguments.length > 2 && (o[n] = a), o[n]) : g.apply(this, arguments);
    };
    var v = e.Tween.prototype.run, j = function(e) {
        return e;
    };
    e.Tween.prototype.run = function() {
        e.easing[this.easing].length > 1 && (r("'jQuery.easing." + this.easing.toString() + "' should use only one argument"), 
        e.easing[this.easing] = j), v.apply(this, arguments);
    }, e.fx.interval = e.fx.interval || 13, t.requestAnimationFrame && n(e.fx, "interval", e.fx.interval, "jQuery.fx.interval is deprecated");
    var Q = e.fn.load, b = e.event.add, w = e.event.fix;
    e.event.props = [], e.event.fixHooks = {}, n(e.event.props, "concat", e.event.props.concat, "jQuery.event.props.concat() is deprecated and removed"), 
    e.event.fix = function(t) {
        var n, a = t.type, o = this.fixHooks[a], i = e.event.props;
        if (i.length) for (r("jQuery.event.props are deprecated and removed: " + i.join()); i.length; ) e.event.addProp(i.pop());
        if (o && !o._migrated_ && (o._migrated_ = !0, r("jQuery.event.fixHooks are deprecated and removed: " + a), 
        (i = o.props) && i.length)) for (;i.length; ) e.event.addProp(i.pop());
        return n = w.call(this, t), o && o.filter ? o.filter(n, t) : n;
    }, e.event.add = function(e, n) {
        return e === t && "load" === n && "complete" === t.document.readyState && r("jQuery(window).on('load'...) called after load event occurred"), 
        b.apply(this, arguments);
    }, e.each([ "load", "unload", "error" ], function(t, n) {
        e.fn[n] = function() {
            var e = Array.prototype.slice.call(arguments, 0);
            return "load" === n && "string" == typeof e[0] ? Q.apply(this, e) : (r("jQuery.fn." + n + "() is deprecated"), 
            e.splice(0, 0, n), arguments.length ? this.on.apply(this, e) : (this.triggerHandler.apply(this, e), 
            this));
        };
    }), e.each("blur focus focusin focusout resize scroll click dblclick mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave change select submit keydown keypress keyup contextmenu".split(" "), function(t, n) {
        e.fn[n] = function(e, t) {
            return r("jQuery.fn." + n + "() event shorthand is deprecated"), arguments.length > 0 ? this.on(n, null, e, t) : this.trigger(n);
        };
    }), e(function() {
        e(t.document).triggerHandler("ready");
    }), e.event.special.ready = {
        setup: function() {
            this === t.document && r("'ready' event is deprecated");
        }
    }, e.fn.extend({
        bind: function(e, t, n) {
            return r("jQuery.fn.bind() is deprecated"), this.on(e, null, t, n);
        },
        unbind: function(e, t) {
            return r("jQuery.fn.unbind() is deprecated"), this.off(e, null, t);
        },
        delegate: function(e, t, n, a) {
            return r("jQuery.fn.delegate() is deprecated"), this.on(t, e, n, a);
        },
        undelegate: function(e, t, n) {
            return r("jQuery.fn.undelegate() is deprecated"), 1 === arguments.length ? this.off(e, "**") : this.off(t, e || "**", n);
        },
        hover: function(e, t) {
            return r("jQuery.fn.hover() is deprecated"), this.on("mouseenter", e).on("mouseleave", t || e);
        }
    });
    var x = e.fn.offset;
    e.fn.offset = function() {
        var n, a = this[0], o = {
            top: 0,
            left: 0
        };
        return a && a.nodeType ? (n = (a.ownerDocument || t.document).documentElement, e.contains(n, a) ? x.apply(this, arguments) : (r("jQuery.fn.offset() requires an element connected to a document"), 
        o)) : (r("jQuery.fn.offset() requires a valid DOM element"), o);
    };
    var k = e.param;
    e.param = function(t, n) {
        var a = e.ajaxSettings && e.ajaxSettings.traditional;
        return void 0 === n && a && (r("jQuery.param() no longer uses jQuery.ajaxSettings.traditional"), 
        n = a), k.call(this, t, n);
    };
    var A = e.fn.andSelf || e.fn.addBack;
    e.fn.andSelf = function() {
        return r("jQuery.fn.andSelf() is deprecated and removed, use jQuery.fn.addBack()"), 
        A.apply(this, arguments);
    };
    var S = e.Deferred, q = [ [ "resolve", "done", e.Callbacks("once memory"), e.Callbacks("once memory"), "resolved" ], [ "reject", "fail", e.Callbacks("once memory"), e.Callbacks("once memory"), "rejected" ], [ "notify", "progress", e.Callbacks("memory"), e.Callbacks("memory") ] ];
    return e.Deferred = function(t) {
        var n = S(), a = n.promise();
        return n.pipe = a.pipe = function() {
            var t = arguments;
            return r("deferred.pipe() is deprecated"), e.Deferred(function(r) {
                e.each(q, function(o, i) {
                    var s = e.isFunction(t[o]) && t[o];
                    n[i[1]](function() {
                        var t = s && s.apply(this, arguments);
                        t && e.isFunction(t.promise) ? t.promise().done(r.resolve).fail(r.reject).progress(r.notify) : r[i[0] + "With"](this === a ? r.promise() : this, s ? [ t ] : arguments);
                    });
                }), t = null;
            }).promise();
        }, t && t.call(n, n), n;
    }, e.Deferred.exceptionHook = S.exceptionHook, e;
});
/*!
* jquery.inputmask.bundle.js
* https://github.com/RobinHerbots/Inputmask
* Copyright (c) 2010 - 2017 Robin Herbots
* Licensed under the MIT license (http://www.opensource.org/licenses/mit-license.php)
* Version: 3.3.11
*/

!function(e){function t(a){if(n[a])return n[a].exports;var i=n[a]={i:a,l:!1,exports:{}};return e[a].call(i.exports,i,i.exports,t),i.l=!0,i.exports}var n={};t.m=e,t.c=n,t.d=function(e,n,a){t.o(e,n)||Object.defineProperty(e,n,{configurable:!1,enumerable:!0,get:a})},t.n=function(e){var n=e&&e.__esModule?function(){return e.default}:function(){return e};return t.d(n,"a",n),n},t.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},t.p="",t(t.s=3)}([function(e,t,n){"use strict";var a,i,r;"function"==typeof Symbol&&Symbol.iterator;!function(o){i=[n(2)],void 0!==(r="function"==typeof(a=o)?a.apply(t,i):a)&&(e.exports=r)}(function(e){return e})},function(e,t,n){"use strict";var a,i,r,o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e};!function(o){i=[n(0),n(10),n(11)],void 0!==(r="function"==typeof(a=o)?a.apply(t,i):a)&&(e.exports=r)}(function(e,t,n,a){function i(t,n,o){if(!(this instanceof i))return new i(t,n,o);this.el=a,this.events={},this.maskset=a,this.refreshValue=!1,!0!==o&&(e.isPlainObject(t)?n=t:(n=n||{}).alias=t,this.opts=e.extend(!0,{},this.defaults,n),this.noMasksCache=n&&n.definitions!==a,this.userOptions=n||{},this.isRTL=this.opts.numericInput,r(this.opts.alias,n,this.opts))}function r(t,n,o){var s=i.prototype.aliases[t];return s?(s.alias&&r(s.alias,a,o),e.extend(!0,o,s),e.extend(!0,o,n),!0):(null===o.mask&&(o.mask=t),!1)}function s(t,n){function r(t,r,o){var s=!1;if(null!==t&&""!==t||((s=null!==o.regex)?t=(t=o.regex).replace(/^(\^)(.*)(\$)$/,"$2"):(s=!0,t=".*")),1===t.length&&!1===o.greedy&&0!==o.repeat&&(o.placeholder=""),o.repeat>0||"*"===o.repeat||"+"===o.repeat){var l="*"===o.repeat?0:"+"===o.repeat?1:o.repeat;t=o.groupmarker.start+t+o.groupmarker.end+o.quantifiermarker.start+l+","+o.repeat+o.quantifiermarker.end}var c,u=s?"regex_"+o.regex:o.numericInput?t.split("").reverse().join(""):t;return i.prototype.masksCache[u]===a||!0===n?(c={mask:t,maskToken:i.prototype.analyseMask(t,s,o),validPositions:{},_buffer:a,buffer:a,tests:{},metadata:r,maskLength:a},!0!==n&&(i.prototype.masksCache[u]=c,c=e.extend(!0,{},i.prototype.masksCache[u]))):c=e.extend(!0,{},i.prototype.masksCache[u]),c}if(e.isFunction(t.mask)&&(t.mask=t.mask(t)),e.isArray(t.mask)){if(t.mask.length>1){t.keepStatic=null===t.keepStatic||t.keepStatic;var o=t.groupmarker.start;return e.each(t.numericInput?t.mask.reverse():t.mask,function(n,i){o.length>1&&(o+=t.groupmarker.end+t.alternatormarker+t.groupmarker.start),i.mask===a||e.isFunction(i.mask)?o+=i:o+=i.mask}),o+=t.groupmarker.end,r(o,t.mask,t)}t.mask=t.mask.pop()}return t.mask&&t.mask.mask!==a&&!e.isFunction(t.mask.mask)?r(t.mask.mask,t.mask,t):r(t.mask,t.mask,t)}function l(r,s,c){function m(e,t,n){t=t||0;var i,r,o,s=[],l=0,u=v();do{!0===e&&h().validPositions[l]?(r=(o=h().validPositions[l]).match,i=o.locator.slice(),s.push(!0===n?o.input:!1===n?r.nativeDef:I(l,r))):(r=(o=b(l,i,l-1)).match,i=o.locator.slice(),(!1===c.jitMasking||l<u||"number"==typeof c.jitMasking&&isFinite(c.jitMasking)&&c.jitMasking>l)&&s.push(!1===n?r.nativeDef:I(l,r))),l++}while((Q===a||l<Q)&&(null!==r.fn||""!==r.def)||t>l);return""===s[s.length-1]&&s.pop(),h().maskLength=l+1,s}function h(){return s}function g(e){var t=h();t.buffer=a,!0!==e&&(t.validPositions={},t.p=0)}function v(e,t,n){var i=-1,r=-1,o=n||h().validPositions;e===a&&(e=-1);for(var s in o){var l=parseInt(s);o[l]&&(t||!0!==o[l].generatedInput)&&(l<=e&&(i=l),l>=e&&(r=l))}return-1!==i&&e-i>1||r<e?i:r}function y(t,n,i,r){var o,s=t,l=e.extend(!0,{},h().validPositions),u=!1;for(h().p=t,o=n-1;o>=s;o--)h().validPositions[o]!==a&&(!0!==i&&(!h().validPositions[o].match.optionality&&function(e){var t=h().validPositions[e];if(t!==a&&null===t.match.fn){var n=h().validPositions[e-1],i=h().validPositions[e+1];return n!==a&&i!==a}return!1}(o)||!1===c.canClearPosition(h(),o,v(),r,c))||delete h().validPositions[o]);for(g(!0),o=s+1;o<=v();){for(;h().validPositions[s]!==a;)s++;if(o<s&&(o=s+1),h().validPositions[o]===a&&M(o))o++;else{var p=b(o);!1===u&&l[s]&&l[s].match.def===p.match.def?(h().validPositions[s]=e.extend(!0,{},l[s]),h().validPositions[s].input=p.input,delete h().validPositions[o],o++):P(s,p.match.def)?!1!==R(s,p.input||I(o),!0)&&(delete h().validPositions[o],o++,u=!0):M(o)||(o++,s--),s++}}g(!0)}function k(e,t){for(var n,i=e,r=v(),o=h().validPositions[r]||S(0)[0],s=o.alternation!==a?o.locator[o.alternation].toString().split(","):[],l=0;l<i.length&&(!((n=i[l]).match&&(c.greedy&&!0!==n.match.optionalQuantifier||(!1===n.match.optionality||!1===n.match.newBlockMarker)&&!0!==n.match.optionalQuantifier)&&(o.alternation===a||o.alternation!==n.alternation||n.locator[o.alternation]!==a&&O(n.locator[o.alternation].toString().split(","),s)))||!0===t&&(null!==n.match.fn||/[0-9a-bA-Z]/.test(n.match.def)));l++);return n}function b(e,t,n){return h().validPositions[e]||k(S(e,t?t.slice():t,n))}function x(e){return h().validPositions[e]?h().validPositions[e]:S(e)[0]}function P(e,t){for(var n=!1,a=S(e),i=0;i<a.length;i++)if(a[i].match&&a[i].match.def===t){n=!0;break}return n}function S(t,n,i){function r(n,i,o,l){function p(o,l,g){function v(t,n){var a=0===e.inArray(t,n.matches);return a||e.each(n.matches,function(e,i){if(!0===i.isQuantifier&&(a=v(t,n.matches[e-1])))return!1}),a}function y(t,n,i){var r,o;if(h().validPositions[t-1]&&i&&h().tests[t])for(var s=h().validPositions[t-1].locator,l=h().tests[t][0].locator,c=0;c<i;c++)if(s[c]!==l[c])return s.slice(i+1);return(h().tests[t]||h().validPositions[t])&&e.each(h().tests[t]||[h().validPositions[t]],function(e,t){var s=i!==a?i:t.alternation,l=t.locator[s]!==a?t.locator[s].toString().indexOf(n):-1;(o===a||l<o)&&-1!==l&&(r=t,o=l)}),r?r.locator.slice((i!==a?i:r.alternation)+1):i!==a?y(t,n):a}if(u>1e4)throw"Inputmask: There is probably an error in your mask definition or in the code. Create an issue on github with an example of the mask you are using. "+h().mask;if(u===t&&o.matches===a)return f.push({match:o,locator:l.reverse(),cd:m}),!0;if(o.matches!==a){if(o.isGroup&&g!==o){if(o=p(n.matches[e.inArray(o,n.matches)+1],l))return!0}else if(o.isOptional){var k=o;if(o=r(o,i,l,g)){if(s=f[f.length-1].match,!v(s,k))return!0;d=!0,u=t}}else if(o.isAlternator){var b,x=o,P=[],S=f.slice(),w=l.length,A=i.length>0?i.shift():-1;if(-1===A||"string"==typeof A){var E,C=u,O=i.slice(),R=[];if("string"==typeof A)R=A.split(",");else for(E=0;E<x.matches.length;E++)R.push(E);for(var M=0;M<R.length;M++){if(E=parseInt(R[M]),f=[],i=y(u,E,w)||O.slice(),!0!==(o=p(x.matches[E]||n.matches[E],[E].concat(l),g)||o)&&o!==a&&R[R.length-1]<x.matches.length){var _=e.inArray(o,n.matches)+1;n.matches.length>_&&(o=p(n.matches[_],[_].concat(l.slice(1,l.length)),g))&&(R.push(_.toString()),e.each(f,function(e,t){t.alternation=l.length-1}))}b=f.slice(),u=C,f=[];for(var D=0;D<b.length;D++){var j=b[D],N=!1;j.alternation=j.alternation||w;for(var I=0;I<P.length;I++){var F=P[I];if("string"!=typeof A||-1!==e.inArray(j.locator[j.alternation].toString(),R)){if(function(e,t){return e.match.nativeDef===t.match.nativeDef||e.match.def===t.match.nativeDef||e.match.nativeDef===t.match.def}(j,F)){N=!0,j.alternation===F.alternation&&-1===F.locator[F.alternation].toString().indexOf(j.locator[j.alternation])&&(F.locator[F.alternation]=F.locator[F.alternation]+","+j.locator[j.alternation],F.alternation=j.alternation),j.match.nativeDef===F.match.def&&(j.locator[j.alternation]=F.locator[F.alternation],P.splice(P.indexOf(F),1,j));break}if(j.match.def===F.match.def){N=!1;break}if(function(e,n){return null===e.match.fn&&null!==n.match.fn&&n.match.fn.test(e.match.def,h(),t,!1,c,!1)}(j,F)||function(e,n){return null!==e.match.fn&&null!==n.match.fn&&n.match.fn.test(e.match.def.replace(/[\[\]]/g,""),h(),t,!1,c,!1)}(j,F)){j.alternation===F.alternation&&-1===j.locator[j.alternation].toString().indexOf(F.locator[F.alternation].toString().split("")[0])&&(j.na=j.na||j.locator[j.alternation].toString(),-1===j.na.indexOf(j.locator[j.alternation].toString().split("")[0])&&(j.na=j.na+","+j.locator[F.alternation].toString().split("")[0]),N=!0,j.locator[j.alternation]=F.locator[F.alternation].toString().split("")[0]+","+j.locator[j.alternation],P.splice(P.indexOf(F),0,j));break}}}N||P.push(j)}}"string"==typeof A&&(P=e.map(P,function(t,n){if(isFinite(n)){var i=t.alternation,r=t.locator[i].toString().split(",");t.locator[i]=a,t.alternation=a;for(var o=0;o<r.length;o++)-1!==e.inArray(r[o],R)&&(t.locator[i]!==a?(t.locator[i]+=",",t.locator[i]+=r[o]):t.locator[i]=parseInt(r[o]),t.alternation=i);if(t.locator[i]!==a)return t}})),f=S.concat(P),u=t,d=f.length>0,o=P.length>0,i=O.slice()}else o=p(x.matches[A]||n.matches[A],[A].concat(l),g);if(o)return!0}else if(o.isQuantifier&&g!==n.matches[e.inArray(o,n.matches)-1])for(var T=o,G=i.length>0?i.shift():0;G<(isNaN(T.quantifier.max)?G+1:T.quantifier.max)&&u<=t;G++){var B=n.matches[e.inArray(T,n.matches)-1];if(o=p(B,[G].concat(l),B)){if(s=f[f.length-1].match,s.optionalQuantifier=G>T.quantifier.min-1,v(s,B)){if(G>T.quantifier.min-1){d=!0,u=t;break}return!0}return!0}}else if(o=r(o,i,l,g))return!0}else u++}for(var g=i.length>0?i.shift():0;g<n.matches.length;g++)if(!0!==n.matches[g].isQuantifier){var v=p(n.matches[g],[g].concat(o),l);if(v&&u===t)return v;if(u>t)break}}function o(e){if(c.keepStatic&&t>0&&e.length>1+(""===e[e.length-1].match.def?1:0)&&!0!==e[0].match.optionality&&!0!==e[0].match.optionalQuantifier&&null===e[0].match.fn&&!/[0-9a-bA-Z]/.test(e[0].match.def)){if(h().validPositions[t-1]===a)return[k(e)];if(h().validPositions[t-1].alternation===e[0].alternation)return[k(e)];if(h().validPositions[t-1])return[k(e)]}return e}var s,l=h().maskToken,u=n?i:0,p=n?n.slice():[0],f=[],d=!1,m=n?n.join(""):"";if(t>-1){if(n===a){for(var g,v=t-1;(g=h().validPositions[v]||h().tests[v])===a&&v>-1;)v--;g!==a&&v>-1&&(p=function(t){var n=[];return e.isArray(t)||(t=[t]),t.length>0&&(t[0].alternation===a?0===(n=k(t.slice()).locator.slice()).length&&(n=t[0].locator.slice()):e.each(t,function(e,t){if(""!==t.def)if(0===n.length)n=t.locator.slice();else for(var a=0;a<n.length;a++)t.locator[a]&&-1===n[a].toString().indexOf(t.locator[a])&&(n[a]+=","+t.locator[a])})),n}(g),m=p.join(""),u=v)}if(h().tests[t]&&h().tests[t][0].cd===m)return o(h().tests[t]);for(var y=p.shift();y<l.length&&!(r(l[y],p,[y])&&u===t||u>t);y++);}return(0===f.length||d)&&f.push({match:{fn:null,cardinality:0,optionality:!0,casing:null,def:"",placeholder:""},locator:[],cd:m}),n!==a&&h().tests[t]?o(e.extend(!0,[],f)):(h().tests[t]=e.extend(!0,[],f),o(h().tests[t]))}function w(){return h()._buffer===a&&(h()._buffer=m(!1,1),h().buffer===a&&(h().buffer=h()._buffer.slice())),h()._buffer}function A(e){return h().buffer!==a&&!0!==e||(h().buffer=m(!0,v(),!0)),h().buffer}function E(e,t,n){var i,r;if(!0===e)g(),e=0,t=n.length;else for(i=e;i<t;i++)delete h().validPositions[i];for(r=e,i=e;i<t;i++)if(g(!0),n[i]!==c.skipOptionalPartCharacter){var o=R(r,n[i],!0,!0);!1!==o&&(g(!0),r=o.caret!==a?o.caret:o.pos+1)}}function C(t,n,a){switch(c.casing||n.casing){case"upper":t=t.toUpperCase();break;case"lower":t=t.toLowerCase();break;case"title":var r=h().validPositions[a-1];t=0===a||r&&r.input===String.fromCharCode(i.keyCode.SPACE)?t.toUpperCase():t.toLowerCase();break;default:if(e.isFunction(c.casing)){var o=Array.prototype.slice.call(arguments);o.push(h().validPositions),t=c.casing.apply(this,o)}}return t}function O(t,n,i){for(var r,o=c.greedy?n:n.slice(0,1),s=!1,l=i!==a?i.split(","):[],u=0;u<l.length;u++)-1!==(r=t.indexOf(l[u]))&&t.splice(r,1);for(var p=0;p<t.length;p++)if(-1!==e.inArray(t[p],o)){s=!0;break}return s}function R(t,n,r,o,s,l){function u(e){var t=Z?e.begin-e.end>1||e.begin-e.end==1:e.end-e.begin>1||e.end-e.begin==1;return t&&0===e.begin&&e.end===h().maskLength?"full":t}function p(n,i,r){var s=!1;return e.each(S(n),function(l,p){for(var d=p.match,m=i?1:0,k="",b=d.cardinality;b>m;b--)k+=j(n-(b-1));if(i&&(k+=i),A(!0),!1!==(s=null!=d.fn?d.fn.test(k,h(),n,r,c,u(t)):(i===d.def||i===c.skipOptionalPartCharacter)&&""!==d.def&&{c:I(n,d,!0)||d.def,pos:n})){var x=s.c!==a?s.c:i;x=x===c.skipOptionalPartCharacter&&null===d.fn?I(n,d,!0)||d.def:x;var P=n,S=A();if(s.remove!==a&&(e.isArray(s.remove)||(s.remove=[s.remove]),e.each(s.remove.sort(function(e,t){return t-e}),function(e,t){y(t,t+1,!0)})),s.insert!==a&&(e.isArray(s.insert)||(s.insert=[s.insert]),e.each(s.insert.sort(function(e,t){return e-t}),function(e,t){R(t.pos,t.c,!0,o)})),s.refreshFromBuffer){var w=s.refreshFromBuffer;if(E(!0===w?w:w.start,w.end,S),s.pos===a&&s.c===a)return s.pos=v(),!1;if((P=s.pos!==a?s.pos:n)!==n)return s=e.extend(s,R(P,x,!0,o)),!1}else if(!0!==s&&s.pos!==a&&s.pos!==n&&(P=s.pos,E(n,P,A().slice()),P!==n))return s=e.extend(s,R(P,x,!0)),!1;return(!0===s||s.pos!==a||s.c!==a)&&(l>0&&g(!0),f(P,e.extend({},p,{input:C(x,d,P)}),o,u(t))||(s=!1),!1)}}),s}function f(t,n,i,r){if(r||c.insertMode&&h().validPositions[t]!==a&&i===a){var o,s=e.extend(!0,{},h().validPositions),l=v(a,!0);for(o=t;o<=l;o++)delete h().validPositions[o];h().validPositions[t]=e.extend(!0,{},n);var u,p=!0,f=h().validPositions,m=!1,y=h().maskLength;for(o=u=t;o<=l;o++){var k=s[o];if(k!==a)for(var b=u;b<h().maskLength&&(null===k.match.fn&&f[o]&&(!0===f[o].match.optionalQuantifier||!0===f[o].match.optionality)||null!=k.match.fn);){if(b++,!1===m&&s[b]&&s[b].match.def===k.match.def)h().validPositions[b]=e.extend(!0,{},s[b]),h().validPositions[b].input=k.input,d(b),u=b,p=!0;else if(P(b,k.match.def)){var x=R(b,k.input,!0,!0);p=!1!==x,u=x.caret||x.insert?v():b,m=!0}else if(!(p=!0===k.generatedInput)&&b>=h().maskLength-1)break;if(h().maskLength<y&&(h().maskLength=y),p)break}if(!p)break}if(!p)return h().validPositions=e.extend(!0,{},s),g(!0),!1}else h().validPositions[t]=e.extend(!0,{},n);return g(!0),!0}function d(t){for(var n=t-1;n>-1&&!h().validPositions[n];n--);var i,r;for(n++;n<t;n++)h().validPositions[n]===a&&(!1===c.jitMasking||c.jitMasking>n)&&(""===(r=S(n,b(n-1).locator,n-1).slice())[r.length-1].match.def&&r.pop(),(i=k(r))&&(i.match.def===c.radixPointDefinitionSymbol||!M(n,!0)||e.inArray(c.radixPoint,A())<n&&i.match.fn&&i.match.fn.test(I(n),h(),n,!1,c))&&!1!==(x=p(n,I(n,i.match,!0)||(null==i.match.fn?i.match.def:""!==I(n)?I(n):A()[n]),!0))&&(h().validPositions[x.pos||n].generatedInput=!0))}r=!0===r;var m=t;t.begin!==a&&(m=Z&&!u(t)?t.end:t.begin);var x=!0,w=e.extend(!0,{},h().validPositions);if(e.isFunction(c.preValidation)&&!r&&!0!==o&&!0!==l&&(x=c.preValidation(A(),m,n,u(t),c)),!0===x){if(d(m),u(t)&&(V(a,i.keyCode.DELETE,t,!0,!0),m=h().p),m<h().maskLength&&(Q===a||m<Q)&&(x=p(m,n,r),(!r||!0===o)&&!1===x&&!0!==l)){var D=h().validPositions[m];if(!D||null!==D.match.fn||D.match.def!==n&&n!==c.skipOptionalPartCharacter){if((c.insertMode||h().validPositions[_(m)]===a)&&!M(m,!0))for(var N=m+1,F=_(m);N<=F;N++)if(!1!==(x=p(N,n,r))){!function(t,n){var i=h().validPositions[n];if(i)for(var r=i.locator,o=r.length,s=t;s<n;s++)if(h().validPositions[s]===a&&!M(s,!0)){var l=S(s).slice(),c=k(l,!0),u=-1;""===l[l.length-1].match.def&&l.pop(),e.each(l,function(e,t){for(var n=0;n<o;n++){if(t.locator[n]===a||!O(t.locator[n].toString().split(","),r[n].toString().split(","),t.na)){var i=r[n],s=c.locator[n],l=t.locator[n];i-s>Math.abs(i-l)&&(c=t);break}u<n&&(u=n,c=t)}}),(c=e.extend({},c,{input:I(s,c.match,!0)||c.match.def})).generatedInput=!0,f(s,c,!0),h().validPositions[n]=a,p(n,i.input,!0)}}(m,x.pos!==a?x.pos:N),m=N;break}}else x={caret:_(m)}}!1===x&&c.keepStatic&&!r&&!0!==s&&(x=function(t,n,i){var r,s,l,u,p,f,d,m,y=e.extend(!0,{},h().validPositions),k=!1,b=v();for(u=h().validPositions[b];b>=0;b--)if((l=h().validPositions[b])&&l.alternation!==a){if(r=b,s=h().validPositions[r].alternation,u.locator[l.alternation]!==l.locator[l.alternation])break;u=l}if(s!==a){m=parseInt(r);var x=u.locator[u.alternation||s]!==a?u.locator[u.alternation||s]:d[0];x.length>0&&(x=x.split(",")[0]);var P=h().validPositions[m],w=h().validPositions[m-1];e.each(S(m,w?w.locator:a,m-1),function(r,l){d=l.locator[s]?l.locator[s].toString().split(","):[];for(var u=0;u<d.length;u++){var b=[],S=0,w=0,A=!1;if(x<d[u]&&(l.na===a||-1===e.inArray(d[u],l.na.split(","))||-1===e.inArray(x.toString(),d))){h().validPositions[m]=e.extend(!0,{},l);var E=h().validPositions[m].locator;for(h().validPositions[m].locator[s]=parseInt(d[u]),null==l.match.fn?(P.input!==l.match.def&&(A=!0,!0!==P.generatedInput&&b.push(P.input)),w++,h().validPositions[m].generatedInput=!/[0-9a-bA-Z]/.test(l.match.def),h().validPositions[m].input=l.match.def):h().validPositions[m].input=P.input,p=m+1;p<v(a,!0)+1;p++)(f=h().validPositions[p])&&!0!==f.generatedInput&&/[0-9a-bA-Z]/.test(f.input)?b.push(f.input):p<t&&S++,delete h().validPositions[p];for(A&&b[0]===l.match.def&&b.shift(),g(!0),k=!0;b.length>0;){var C=b.shift();if(C!==c.skipOptionalPartCharacter&&!(k=R(v(a,!0)+1,C,!1,o,!0)))break}if(k){h().validPositions[m].locator=E;var O=v(t)+1;for(p=m+1;p<v()+1;p++)((f=h().validPositions[p])===a||null==f.match.fn)&&p<t+(w-S)&&w++;k=R((t+=w-S)>O?O:t,n,i,o,!0)}if(k)return!1;g(),h().validPositions=e.extend(!0,{},y)}}})}return k}(m,n,r)),!0===x&&(x={pos:m})}if(e.isFunction(c.postValidation)&&!1!==x&&!r&&!0!==o&&!0!==l){var T=c.postValidation(A(!0),x,c);if(T.refreshFromBuffer&&T.buffer){var G=T.refreshFromBuffer;E(!0===G?G:G.start,G.end,T.buffer)}x=!0===T?x:T}return x&&x.pos===a&&(x.pos=m),!1!==x&&!0!==l||(g(!0),h().validPositions=e.extend(!0,{},w)),x}function M(e,t){var n=b(e).match;if(""===n.def&&(n=x(e).match),null!=n.fn)return n.fn;if(!0!==t&&e>-1){var a=S(e);return a.length>1+(""===a[a.length-1].match.def?1:0)}return!1}function _(e,t){var n=h().maskLength;if(e>=n)return n;var a=e;for(S(n+1).length>1&&(m(!0,n+1,!0),n=h().maskLength);++a<n&&(!0===t&&(!0!==x(a).match.newBlockMarker||!M(a))||!0!==t&&!M(a)););return a}function D(e,t){var n,a=e;if(a<=0)return 0;for(;--a>0&&(!0===t&&!0!==x(a).match.newBlockMarker||!0!==t&&!M(a)&&((n=S(a)).length<2||2===n.length&&""===n[1].match.def)););return a}function j(e){return h().validPositions[e]===a?I(e):h().validPositions[e].input}function N(t,n,i,r,o){if(r&&e.isFunction(c.onBeforeWrite)){var s=c.onBeforeWrite.call(W,r,n,i,c);if(s){if(s.refreshFromBuffer){var l=s.refreshFromBuffer;E(!0===l?l:l.start,l.end,s.buffer||n),n=A(!0)}i!==a&&(i=s.caret!==a?s.caret:i)}}t!==a&&(t.inputmask._valueSet(n.join("")),i===a||r!==a&&"blur"===r.type?H(t,i,0===n.length):d&&r&&"input"===r.type?setTimeout(function(){G(t,i)},0):G(t,i),!0===o&&(X=!0,e(t).trigger("input")))}function I(t,n,i){if((n=n||x(t).match).placeholder!==a||!0===i)return e.isFunction(n.placeholder)?n.placeholder(c):n.placeholder;if(null===n.fn){if(t>-1&&h().validPositions[t]===a){var r,o=S(t),s=[];if(o.length>1+(""===o[o.length-1].match.def?1:0))for(var l=0;l<o.length;l++)if(!0!==o[l].match.optionality&&!0!==o[l].match.optionalQuantifier&&(null===o[l].match.fn||r===a||!1!==o[l].match.fn.test(r.match.def,h(),t,!0,c))&&(s.push(o[l]),null===o[l].match.fn&&(r=o[l]),s.length>1&&/[0-9a-bA-Z]/.test(s[0].match.def)))return c.placeholder.charAt(t%c.placeholder.length)}return n.def}return c.placeholder.charAt(t%c.placeholder.length)}function F(t,r,o,s,l){function u(e,t){return-1!==w().slice(e,_(e)).join("").indexOf(t)&&!M(e)&&x(e).match.nativeDef===t.charAt(t.length-1)}var p=s.slice(),f="",d=-1,m=a;if(g(),o||!0===c.autoUnmask)d=_(d);else{var y=w().slice(0,_(-1)).join(""),k=p.join("").match(new RegExp("^"+i.escapeRegex(y),"g"));k&&k.length>0&&(p.splice(0,k.length*y.length),d=_(d))}if(-1===d?(h().p=_(d),d=0):h().p=d,e.each(p,function(n,i){if(i!==a)if(h().validPositions[n]===a&&p[n]===I(n)&&M(n,!0)&&!1===R(n,p[n],!0,a,a,!0))h().p++;else{var r=new e.Event("_checkval");r.which=i.charCodeAt(0),f+=i;var s=v(a,!0),l=h().validPositions[s],y=b(s+1,l?l.locator.slice():a,s);if(!u(d,f)||o||c.autoUnmask){var k=o?n:null==y.match.fn&&y.match.optionality&&s+1<h().p?s+1:h().p;m=ae.keypressEvent.call(t,r,!0,!1,o,k),d=k+1,f=""}else m=ae.keypressEvent.call(t,r,!0,!1,!0,s+1);if(!1!==m&&!o&&e.isFunction(c.onBeforeWrite)){var x=m;if(m=c.onBeforeWrite.call(W,r,A(),m.forwardPosition,c),(m=e.extend(x,m))&&m.refreshFromBuffer){var P=m.refreshFromBuffer;E(!0===P?P:P.start,P.end,m.buffer),g(!0),m.caret&&(h().p=m.caret,m.forwardPosition=m.caret)}}}}),r){var P=a;n.activeElement===t&&m&&(P=c.numericInput?D(m.forwardPosition):m.forwardPosition),N(t,A(),P,l||new e.Event("checkval"),l&&"input"===l.type)}}function T(t){if(t){if(t.inputmask===a)return t.value;t.inputmask&&t.inputmask.refreshValue&&ae.setValueEvent.call(t)}var n=[],i=h().validPositions;for(var r in i)i[r].match&&null!=i[r].match.fn&&n.push(i[r].input);var o=0===n.length?"":(Z?n.reverse():n).join("");if(e.isFunction(c.onUnMask)){var s=(Z?A().slice().reverse():A()).join("");o=c.onUnMask.call(W,s,o,c)}return o}function G(e,i,r,o){function s(e){return!0===o||!Z||"number"!=typeof e||c.greedy&&""===c.placeholder||(e=A().join("").length-e),e}var l;if(i===a)return e.setSelectionRange?(i=e.selectionStart,r=e.selectionEnd):t.getSelection?(l=t.getSelection().getRangeAt(0)).commonAncestorContainer.parentNode!==e&&l.commonAncestorContainer!==e||(i=l.startOffset,r=l.endOffset):n.selection&&n.selection.createRange&&(r=(i=0-(l=n.selection.createRange()).duplicate().moveStart("character",-e.inputmask._valueGet().length))+l.text.length),{begin:s(i),end:s(r)};if(i.begin!==a&&(r=i.end,i=i.begin),"number"==typeof i){i=s(i),r="number"==typeof(r=s(r))?r:i;var p=parseInt(((e.ownerDocument.defaultView||t).getComputedStyle?(e.ownerDocument.defaultView||t).getComputedStyle(e,null):e.currentStyle).fontSize)*r;if(e.scrollLeft=p>e.scrollWidth?p:0,u||!1!==c.insertMode||i!==r||r++,e.setSelectionRange)e.selectionStart=i,e.selectionEnd=r;else if(t.getSelection){if(l=n.createRange(),e.firstChild===a||null===e.firstChild){var f=n.createTextNode("");e.appendChild(f)}l.setStart(e.firstChild,i<e.inputmask._valueGet().length?i:e.inputmask._valueGet().length),l.setEnd(e.firstChild,r<e.inputmask._valueGet().length?r:e.inputmask._valueGet().length),l.collapse(!0);var d=t.getSelection();d.removeAllRanges(),d.addRange(l)}else e.createTextRange&&((l=e.createTextRange()).collapse(!0),l.moveEnd("character",r),l.moveStart("character",i),l.select());H(e,{begin:i,end:r})}}function B(t){var n,i,r=A(),o=r.length,s=v(),l={},c=h().validPositions[s],u=c!==a?c.locator.slice():a;for(n=s+1;n<r.length;n++)u=(i=b(n,u,n-1)).locator.slice(),l[n]=e.extend(!0,{},i);var p=c&&c.alternation!==a?c.locator[c.alternation]:a;for(n=o-1;n>s&&(((i=l[n]).match.optionality||i.match.optionalQuantifier&&i.match.newBlockMarker||p&&(p!==l[n].locator[c.alternation]&&null!=i.match.fn||null===i.match.fn&&i.locator[c.alternation]&&O(i.locator[c.alternation].toString().split(","),p.toString().split(","))&&""!==S(n)[0].def))&&r[n]===I(n,i.match));n--)o--;return t?{l:o,def:l[o]?l[o].match:a}:o}function L(e){for(var t,n=B(),i=e.length,r=h().validPositions[v()];n<i&&!M(n,!0)&&(t=r!==a?b(n,r.locator.slice(""),r):x(n))&&!0!==t.match.optionality&&(!0!==t.match.optionalQuantifier&&!0!==t.match.newBlockMarker||n+1===i&&""===(r!==a?b(n+1,r.locator.slice(""),r):x(n+1)).match.def);)n++;for(;(t=h().validPositions[n-1])&&t&&t.match.optionality&&t.input===c.skipOptionalPartCharacter;)n--;return e.splice(n),e}function U(t){if(e.isFunction(c.isComplete))return c.isComplete(t,c);if("*"===c.repeat)return a;var n=!1,i=B(!0),r=D(i.l);if(i.def===a||i.def.newBlockMarker||i.def.optionality||i.def.optionalQuantifier){n=!0;for(var o=0;o<=r;o++){var s=b(o).match;if(null!==s.fn&&h().validPositions[o]===a&&!0!==s.optionality&&!0!==s.optionalQuantifier||null===s.fn&&t[o]!==I(o,s)){n=!1;break}}}return n}function V(t,n,r,o,s){if((c.numericInput||Z)&&(n===i.keyCode.BACKSPACE?n=i.keyCode.DELETE:n===i.keyCode.DELETE&&(n=i.keyCode.BACKSPACE),Z)){var l=r.end;r.end=r.begin,r.begin=l}n===i.keyCode.BACKSPACE&&(r.end-r.begin<1||!1===c.insertMode)?(r.begin=D(r.begin),h().validPositions[r.begin]!==a&&h().validPositions[r.begin].input===c.groupSeparator&&r.begin--):n===i.keyCode.DELETE&&r.begin===r.end&&(r.end=M(r.end,!0)&&h().validPositions[r.end]&&h().validPositions[r.end].input!==c.radixPoint?r.end+1:_(r.end)+1,h().validPositions[r.begin]!==a&&h().validPositions[r.begin].input===c.groupSeparator&&r.end++),y(r.begin,r.end,!1,o),!0!==o&&function(){if(c.keepStatic){for(var n=[],i=v(-1,!0),r=e.extend(!0,{},h().validPositions),o=h().validPositions[i];i>=0;i--){var s=h().validPositions[i];if(s){if(!0!==s.generatedInput&&/[0-9a-bA-Z]/.test(s.input)&&n.push(s.input),delete h().validPositions[i],s.alternation!==a&&s.locator[s.alternation]!==o.locator[s.alternation])break;o=s}}if(i>-1)for(h().p=_(v(-1,!0));n.length>0;){var l=new e.Event("keypress");l.which=n.pop().charCodeAt(0),ae.keypressEvent.call(t,l,!0,!1,!1,h().p)}else h().validPositions=e.extend(!0,{},r)}}();var u=v(r.begin,!0);if(u<r.begin)h().p=_(u);else if(!0!==o&&(h().p=r.begin,!0!==s))for(;h().p<u&&h().validPositions[h().p]===a;)h().p++}function K(a){function i(e){var t,i=n.createElement("span");for(var o in r)isNaN(o)&&-1!==o.indexOf("font")&&(i.style[o]=r[o]);i.style.textTransform=r.textTransform,i.style.letterSpacing=r.letterSpacing,i.style.position="absolute",i.style.height="auto",i.style.width="auto",i.style.visibility="hidden",i.style.whiteSpace="nowrap",n.body.appendChild(i);var s,l=a.inputmask._valueGet(),c=0;for(t=0,s=l.length;t<=s;t++){if(i.innerHTML+=l.charAt(t)||"_",i.offsetWidth>=e){var u=e-c,p=i.offsetWidth-e;i.innerHTML=l.charAt(t),t=(u-=i.offsetWidth/3)<p?t-1:t;break}c=i.offsetWidth}return n.body.removeChild(i),t}var r=(a.ownerDocument.defaultView||t).getComputedStyle(a,null),o=n.createElement("div");o.style.width=r.width,o.style.textAlign=r.textAlign,($=n.createElement("div")).className="im-colormask",a.parentNode.insertBefore($,a),a.parentNode.removeChild(a),$.appendChild(o),$.appendChild(a),a.style.left=o.offsetLeft+"px",e(a).on("click",function(e){return G(a,i(e.clientX)),ae.clickEvent.call(a,[e])}),e(a).on("keydown",function(e){e.shiftKey||!1===c.insertMode||setTimeout(function(){H(a)},0)})}function H(e,t,i){function r(){f||null!==s.fn&&l.input!==a?f&&(null!==s.fn&&l.input!==a||""===s.def)&&(f=!1,p+="</span>"):(f=!0,p+="<span class='im-static'>")}function o(a){!0!==a&&d!==t.begin||n.activeElement!==e||(p+="<span class='im-caret' style='border-right-width: 1px;border-right-style: solid;'></span>")}var s,l,u,p="",f=!1,d=0;if($!==a){var m=A();if(t===a?t=G(e):t.begin===a&&(t={begin:t,end:t}),!0!==i){var g=v();do{o(),h().validPositions[d]?(l=h().validPositions[d],s=l.match,u=l.locator.slice(),r(),p+=m[d]):(l=b(d,u,d-1),s=l.match,u=l.locator.slice(),(!1===c.jitMasking||d<g||"number"==typeof c.jitMasking&&isFinite(c.jitMasking)&&c.jitMasking>d)&&(r(),p+=I(d,s))),d++}while((Q===a||d<Q)&&(null!==s.fn||""!==s.def)||g>d||f);-1===p.indexOf("im-caret")&&o(!0),f&&r()}var y=$.getElementsByTagName("div")[0];y.innerHTML=p,e.inputmask.positionColorMask(e,y)}}s=s||this.maskset,c=c||this.opts;var z,q,Q,$,W=this,Y=this.el,Z=this.isRTL,J=!1,X=!1,ee=!1,te=!1,ne={on:function(t,n,r){var o=function(t){if(this.inputmask===a&&"FORM"!==this.nodeName){var n=e.data(this,"_inputmask_opts");n?new i(n).mask(this):ne.off(this)}else{if("setvalue"===t.type||"FORM"===this.nodeName||!(this.disabled||this.readOnly&&!("keydown"===t.type&&t.ctrlKey&&67===t.keyCode||!1===c.tabThrough&&t.keyCode===i.keyCode.TAB))){switch(t.type){case"input":if(!0===X)return X=!1,t.preventDefault();break;case"keydown":J=!1,X=!1;break;case"keypress":if(!0===J)return t.preventDefault();J=!0;break;case"click":if(p||f){var o=this,s=arguments;return setTimeout(function(){r.apply(o,s)},0),!1}}var l=r.apply(this,arguments);return!1===l&&(t.preventDefault(),t.stopPropagation()),l}t.preventDefault()}};t.inputmask.events[n]=t.inputmask.events[n]||[],t.inputmask.events[n].push(o),-1!==e.inArray(n,["submit","reset"])?null!==t.form&&e(t.form).on(n,o):e(t).on(n,o)},off:function(t,n){if(t.inputmask&&t.inputmask.events){var a;n?(a=[])[n]=t.inputmask.events[n]:a=t.inputmask.events,e.each(a,function(n,a){for(;a.length>0;){var i=a.pop();-1!==e.inArray(n,["submit","reset"])?null!==t.form&&e(t.form).off(n,i):e(t).off(n,i)}delete t.inputmask.events[n]})}}},ae={keydownEvent:function(t){var a=this,r=e(a),o=t.keyCode,s=G(a);if(o===i.keyCode.BACKSPACE||o===i.keyCode.DELETE||f&&o===i.keyCode.BACKSPACE_SAFARI||t.ctrlKey&&o===i.keyCode.X&&!function(e){var t=n.createElement("input"),a="on"+e,i=a in t;return i||(t.setAttribute(a,"return;"),i="function"==typeof t[a]),t=null,i}("cut"))t.preventDefault(),V(a,o,s),N(a,A(!0),h().p,t,a.inputmask._valueGet()!==A().join("")),a.inputmask._valueGet()===w().join("")?r.trigger("cleared"):!0===U(A())&&r.trigger("complete");else if(o===i.keyCode.END||o===i.keyCode.PAGE_DOWN){t.preventDefault();var l=_(v());c.insertMode||l!==h().maskLength||t.shiftKey||l--,G(a,t.shiftKey?s.begin:l,l,!0)}else o===i.keyCode.HOME&&!t.shiftKey||o===i.keyCode.PAGE_UP?(t.preventDefault(),G(a,0,t.shiftKey?s.begin:0,!0)):(c.undoOnEscape&&o===i.keyCode.ESCAPE||90===o&&t.ctrlKey)&&!0!==t.altKey?(F(a,!0,!1,z.split("")),r.trigger("click")):o!==i.keyCode.INSERT||t.shiftKey||t.ctrlKey?!0===c.tabThrough&&o===i.keyCode.TAB?(!0===t.shiftKey?(null===x(s.begin).match.fn&&(s.begin=_(s.begin)),s.end=D(s.begin,!0),s.begin=D(s.end,!0)):(s.begin=_(s.begin,!0),s.end=_(s.begin,!0),s.end<h().maskLength&&s.end--),s.begin<h().maskLength&&(t.preventDefault(),G(a,s.begin,s.end))):t.shiftKey||!1===c.insertMode&&(o===i.keyCode.RIGHT?setTimeout(function(){var e=G(a);G(a,e.begin)},0):o===i.keyCode.LEFT&&setTimeout(function(){var e=G(a);G(a,Z?e.begin+1:e.begin-1)},0)):(c.insertMode=!c.insertMode,G(a,c.insertMode||s.begin!==h().maskLength?s.begin:s.begin-1));c.onKeyDown.call(this,t,A(),G(a).begin,c),ee=-1!==e.inArray(o,c.ignorables)},keypressEvent:function(t,n,r,o,s){var l=this,u=e(l),p=t.which||t.charCode||t.keyCode;if(!(!0===n||t.ctrlKey&&t.altKey)&&(t.ctrlKey||t.metaKey||ee))return p===i.keyCode.ENTER&&z!==A().join("")&&(z=A().join(""),setTimeout(function(){u.trigger("change")},0)),!0;if(p){46===p&&!1===t.shiftKey&&""!==c.radixPoint&&(p=c.radixPoint.charCodeAt(0));var f,d=n?{begin:s,end:s}:G(l),m=String.fromCharCode(p);h().writeOutBuffer=!0;var v=R(d,m,o);if(!1!==v&&(g(!0),f=v.caret!==a?v.caret:n?v.pos+1:_(v.pos),h().p=f),!1!==r&&(setTimeout(function(){c.onKeyValidation.call(l,p,v,c)},0),h().writeOutBuffer&&!1!==v)){var y=A();N(l,y,c.numericInput&&v.caret===a?D(f):f,t,!0!==n),!0!==n&&setTimeout(function(){!0===U(y)&&u.trigger("complete")},0)}if(t.preventDefault(),n)return!1!==v&&(v.forwardPosition=f),v}},pasteEvent:function(n){var a,i=this,r=n.originalEvent||n,o=e(i),s=i.inputmask._valueGet(!0),l=G(i);Z&&(a=l.end,l.end=l.begin,l.begin=a);var u=s.substr(0,l.begin),p=s.substr(l.end,s.length);if(u===(Z?w().reverse():w()).slice(0,l.begin).join("")&&(u=""),p===(Z?w().reverse():w()).slice(l.end).join("")&&(p=""),Z&&(a=u,u=p,p=a),t.clipboardData&&t.clipboardData.getData)s=u+t.clipboardData.getData("Text")+p;else{if(!r.clipboardData||!r.clipboardData.getData)return!0;s=u+r.clipboardData.getData("text/plain")+p}var f=s;if(e.isFunction(c.onBeforePaste)){if(!1===(f=c.onBeforePaste.call(W,s,c)))return n.preventDefault();f||(f=s)}return F(i,!1,!1,Z?f.split("").reverse():f.toString().split("")),N(i,A(),_(v()),n,z!==A().join("")),!0===U(A())&&o.trigger("complete"),n.preventDefault()},inputFallBackEvent:function(t){var n=this,a=n.inputmask._valueGet();if(A().join("")!==a){var r=G(n);if(!1===function(t,n,a){if("."===n.charAt(a.begin-1)&&""!==c.radixPoint&&((n=n.split(""))[a.begin-1]=c.radixPoint.charAt(0),n=n.join("")),n.charAt(a.begin-1)===c.radixPoint&&n.length>A().length){var i=new e.Event("keypress");return i.which=c.radixPoint.charCodeAt(0),ae.keypressEvent.call(t,i,!0,!0,!1,a.begin-1),!1}}(n,a,r))return!1;if(a=a.replace(new RegExp("("+i.escapeRegex(w().join(""))+")*"),""),!1===function(t,n,a){if(p){var i=n.replace(A().join(""),"");if(1===i.length){var r=new e.Event("keypress");return r.which=i.charCodeAt(0),ae.keypressEvent.call(t,r,!0,!0,!1,h().validPositions[a.begin-1]?a.begin:a.begin-1),!1}}}(n,a,r))return!1;r.begin>a.length&&(G(n,a.length),r=G(n));var o=A().join(""),s=a.substr(0,r.begin),l=a.substr(r.begin),u=o.substr(0,r.begin),f=o.substr(r.begin),d=r,m="",g=!1;if(s!==u){d.begin=0;for(var v=(g=s.length>=u.length)?s.length:u.length,y=0;s.charAt(y)===u.charAt(y)&&y<v;y++)d.begin++;g&&(m+=s.slice(d.begin,d.end))}l!==f&&(l.length>f.length?g&&(d.end=d.begin):l.length<f.length?d.end+=f.length-l.length:l.charAt(0)!==f.charAt(0)&&d.end++),N(n,A(),d),m.length>0?e.each(m.split(""),function(t,a){var i=new e.Event("keypress");i.which=a.charCodeAt(0),ee=!1,ae.keypressEvent.call(n,i)}):(d.begin===d.end-1&&G(n,D(d.begin+1),d.end),t.keyCode=i.keyCode.DELETE,ae.keydownEvent.call(n,t)),t.preventDefault()}},setValueEvent:function(t){this.inputmask.refreshValue=!1;var n=this,a=n.inputmask._valueGet(!0);e.isFunction(c.onBeforeMask)&&(a=c.onBeforeMask.call(W,a,c)||a),a=a.split(""),F(n,!0,!1,Z?a.reverse():a),z=A().join(""),(c.clearMaskOnLostFocus||c.clearIncomplete)&&n.inputmask._valueGet()===w().join("")&&n.inputmask._valueSet("")},focusEvent:function(e){var t=this,n=t.inputmask._valueGet();c.showMaskOnFocus&&(!c.showMaskOnHover||c.showMaskOnHover&&""===n)&&(t.inputmask._valueGet()!==A().join("")?N(t,A(),_(v())):!1===te&&G(t,_(v()))),!0===c.positionCaretOnTab&&!1===te&&""!==n&&(N(t,A(),G(t)),ae.clickEvent.apply(t,[e,!0])),z=A().join("")},mouseleaveEvent:function(e){var t=this;if(te=!1,c.clearMaskOnLostFocus&&n.activeElement!==t){var a=A().slice(),i=t.inputmask._valueGet();i!==t.getAttribute("placeholder")&&""!==i&&(-1===v()&&i===w().join("")?a=[]:L(a),N(t,a))}},clickEvent:function(t,i){function r(t){if(""!==c.radixPoint){var n=h().validPositions;if(n[t]===a||n[t].input===I(t)){if(t<_(-1))return!0;var i=e.inArray(c.radixPoint,A());if(-1!==i){for(var r in n)if(i<r&&n[r].input!==I(r))return!1;return!0}}}return!1}var o=this;setTimeout(function(){if(n.activeElement===o){var e=G(o);if(i&&(Z?e.end=e.begin:e.begin=e.end),e.begin===e.end)switch(c.positionCaretOnClick){case"none":break;case"radixFocus":if(r(e.begin)){var t=A().join("").indexOf(c.radixPoint);G(o,c.numericInput?_(t):t);break}default:var s=e.begin,l=v(s,!0),u=_(l);if(s<u)G(o,M(s,!0)||M(s-1,!0)?s:_(s));else{var p=h().validPositions[l],f=b(u,p?p.match.locator:a,p),d=I(u,f.match);if(""!==d&&A()[u]!==d&&!0!==f.match.optionalQuantifier&&!0!==f.match.newBlockMarker||!M(u,!0)&&f.match.def===d){var m=_(u);(s>=m||s===u)&&(u=m)}G(o,u)}}}},0)},dblclickEvent:function(e){var t=this;setTimeout(function(){G(t,0,_(v()))},0)},cutEvent:function(a){var r=this,o=e(r),s=G(r),l=a.originalEvent||a,c=t.clipboardData||l.clipboardData,u=Z?A().slice(s.end,s.begin):A().slice(s.begin,s.end);c.setData("text",Z?u.reverse().join(""):u.join("")),n.execCommand&&n.execCommand("copy"),V(r,i.keyCode.DELETE,s),N(r,A(),h().p,a,z!==A().join("")),r.inputmask._valueGet()===w().join("")&&o.trigger("cleared")},blurEvent:function(t){var n=e(this),i=this;if(i.inputmask){var r=i.inputmask._valueGet(),o=A().slice();""!==r&&(c.clearMaskOnLostFocus&&(-1===v()&&r===w().join("")?o=[]:L(o)),!1===U(o)&&(setTimeout(function(){n.trigger("incomplete")},0),c.clearIncomplete&&(g(),o=c.clearMaskOnLostFocus?[]:w().slice())),N(i,o,a,t)),z!==A().join("")&&(z=o.join(""),n.trigger("change"))}},mouseenterEvent:function(e){var t=this;te=!0,n.activeElement!==t&&c.showMaskOnHover&&t.inputmask._valueGet()!==A().join("")&&N(t,A())},submitEvent:function(e){z!==A().join("")&&q.trigger("change"),c.clearMaskOnLostFocus&&-1===v()&&Y.inputmask._valueGet&&Y.inputmask._valueGet()===w().join("")&&Y.inputmask._valueSet(""),c.removeMaskOnSubmit&&(Y.inputmask._valueSet(Y.inputmask.unmaskedvalue(),!0),setTimeout(function(){N(Y,A())},0))},resetEvent:function(e){Y.inputmask.refreshValue=!0,setTimeout(function(){q.trigger("setvalue")},0)}};i.prototype.positionColorMask=function(e,t){e.style.left=t.offsetLeft+"px"};var ie;if(r!==a)switch(r.action){case"isComplete":return Y=r.el,U(A());case"unmaskedvalue":return Y!==a&&r.value===a||(ie=r.value,ie=(e.isFunction(c.onBeforeMask)?c.onBeforeMask.call(W,ie,c)||ie:ie).split(""),F(a,!1,!1,Z?ie.reverse():ie),e.isFunction(c.onBeforeWrite)&&c.onBeforeWrite.call(W,a,A(),0,c)),T(Y);case"mask":!function(t){ne.off(t);var i=function(t,i){var r=t.getAttribute("type"),s="INPUT"===t.tagName&&-1!==e.inArray(r,i.supportsInputType)||t.isContentEditable||"TEXTAREA"===t.tagName;if(!s)if("INPUT"===t.tagName){var l=n.createElement("input");l.setAttribute("type",r),s="text"===l.type,l=null}else s="partial";return!1!==s?function(t){function r(){return this.inputmask?this.inputmask.opts.autoUnmask?this.inputmask.unmaskedvalue():-1!==v()||!0!==i.nullable?n.activeElement===this&&i.clearMaskOnLostFocus?(Z?L(A().slice()).reverse():L(A().slice())).join(""):l.call(this):"":l.call(this)}function s(t){c.call(this,t),this.inputmask&&e(this).trigger("setvalue")}var l,c;if(!t.inputmask.__valueGet){if(!0!==i.noValuePatching){if(Object.getOwnPropertyDescriptor){"function"!=typeof Object.getPrototypeOf&&(Object.getPrototypeOf="object"===o("test".__proto__)?function(e){return e.__proto__}:function(e){return e.constructor.prototype});var u=Object.getPrototypeOf?Object.getOwnPropertyDescriptor(Object.getPrototypeOf(t),"value"):a;u&&u.get&&u.set?(l=u.get,c=u.set,Object.defineProperty(t,"value",{get:r,set:s,configurable:!0})):"INPUT"!==t.tagName&&(l=function(){return this.textContent},c=function(e){this.textContent=e},Object.defineProperty(t,"value",{get:r,set:s,configurable:!0}))}else n.__lookupGetter__&&t.__lookupGetter__("value")&&(l=t.__lookupGetter__("value"),c=t.__lookupSetter__("value"),t.__defineGetter__("value",r),t.__defineSetter__("value",s));t.inputmask.__valueGet=l,t.inputmask.__valueSet=c}t.inputmask._valueGet=function(e){return Z&&!0!==e?l.call(this.el).split("").reverse().join(""):l.call(this.el)},t.inputmask._valueSet=function(e,t){c.call(this.el,null===e||e===a?"":!0!==t&&Z?e.split("").reverse().join(""):e)},l===a&&(l=function(){return this.value},c=function(e){this.value=e},function(t){if(e.valHooks&&(e.valHooks[t]===a||!0!==e.valHooks[t].inputmaskpatch)){var n=e.valHooks[t]&&e.valHooks[t].get?e.valHooks[t].get:function(e){return e.value},r=e.valHooks[t]&&e.valHooks[t].set?e.valHooks[t].set:function(e,t){return e.value=t,e};e.valHooks[t]={get:function(e){if(e.inputmask){if(e.inputmask.opts.autoUnmask)return e.inputmask.unmaskedvalue();var t=n(e);return-1!==v(a,a,e.inputmask.maskset.validPositions)||!0!==i.nullable?t:""}return n(e)},set:function(t,n){var a,i=e(t);return a=r(t,n),t.inputmask&&i.trigger("setvalue"),a},inputmaskpatch:!0}}}(t.type),function(t){ne.on(t,"mouseenter",function(t){var n=e(this);this.inputmask._valueGet()!==A().join("")&&n.trigger("setvalue")})}(t))}}(t):t.inputmask=a,s}(t,c);if(!1!==i&&(Y=t,q=e(Y),-1===(Q=Y!==a?Y.maxLength:a)&&(Q=a),!0===c.colorMask&&K(Y),d&&(Y.hasOwnProperty("inputmode")&&(Y.inputmode=c.inputmode,Y.setAttribute("inputmode",c.inputmode)),"rtfm"===c.androidHack&&(!0!==c.colorMask&&K(Y),Y.type="password")),!0===i&&(ne.on(Y,"submit",ae.submitEvent),ne.on(Y,"reset",ae.resetEvent),ne.on(Y,"mouseenter",ae.mouseenterEvent),ne.on(Y,"blur",ae.blurEvent),ne.on(Y,"focus",ae.focusEvent),ne.on(Y,"mouseleave",ae.mouseleaveEvent),!0!==c.colorMask&&ne.on(Y,"click",ae.clickEvent),ne.on(Y,"dblclick",ae.dblclickEvent),ne.on(Y,"paste",ae.pasteEvent),ne.on(Y,"dragdrop",ae.pasteEvent),ne.on(Y,"drop",ae.pasteEvent),ne.on(Y,"cut",ae.cutEvent),ne.on(Y,"complete",c.oncomplete),ne.on(Y,"incomplete",c.onincomplete),ne.on(Y,"cleared",c.oncleared),d||!0===c.inputEventOnly?Y.removeAttribute("maxLength"):(ne.on(Y,"keydown",ae.keydownEvent),ne.on(Y,"keypress",ae.keypressEvent)),ne.on(Y,"compositionstart",e.noop),ne.on(Y,"compositionupdate",e.noop),ne.on(Y,"compositionend",e.noop),ne.on(Y,"keyup",e.noop),ne.on(Y,"input",ae.inputFallBackEvent),ne.on(Y,"beforeinput",e.noop)),ne.on(Y,"setvalue",ae.setValueEvent),z=w().join(""),""!==Y.inputmask._valueGet(!0)||!1===c.clearMaskOnLostFocus||n.activeElement===Y)){var r=e.isFunction(c.onBeforeMask)?c.onBeforeMask.call(W,Y.inputmask._valueGet(!0),c)||Y.inputmask._valueGet(!0):Y.inputmask._valueGet(!0);""!==r&&F(Y,!0,!1,Z?r.split("").reverse():r.split(""));var s=A().slice();z=s.join(""),!1===U(s)&&c.clearIncomplete&&g(),c.clearMaskOnLostFocus&&n.activeElement!==Y&&(-1===v()?s=[]:L(s)),N(Y,s),n.activeElement===Y&&G(Y,_(v()))}}(Y);break;case"format":return ie=(e.isFunction(c.onBeforeMask)?c.onBeforeMask.call(W,r.value,c)||r.value:r.value).split(""),F(a,!0,!1,Z?ie.reverse():ie),r.metadata?{value:Z?A().slice().reverse().join(""):A().join(""),metadata:l.call(this,{action:"getmetadata"},s,c)}:Z?A().slice().reverse().join(""):A().join("");case"isValid":r.value?(ie=r.value.split(""),F(a,!0,!0,Z?ie.reverse():ie)):r.value=A().join("");for(var re=A(),oe=B(),se=re.length-1;se>oe&&!M(se);se--);return re.splice(oe,se+1-oe),U(re)&&r.value===A().join("");case"getemptymask":return w().join("");case"remove":if(Y&&Y.inputmask){q=e(Y),Y.inputmask._valueSet(c.autoUnmask?T(Y):Y.inputmask._valueGet(!0)),ne.off(Y);Object.getOwnPropertyDescriptor&&Object.getPrototypeOf?Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Y),"value")&&Y.inputmask.__valueGet&&Object.defineProperty(Y,"value",{get:Y.inputmask.__valueGet,set:Y.inputmask.__valueSet,configurable:!0}):n.__lookupGetter__&&Y.__lookupGetter__("value")&&Y.inputmask.__valueGet&&(Y.__defineGetter__("value",Y.inputmask.__valueGet),Y.__defineSetter__("value",Y.inputmask.__valueSet)),Y.inputmask=a}return Y;case"getmetadata":if(e.isArray(s.metadata)){var le=m(!0,0,!1).join("");return e.each(s.metadata,function(e,t){if(t.mask===le)return le=t,!1}),le}return s.metadata}}var c=navigator.userAgent,u=/mobile/i.test(c),p=/iemobile/i.test(c),f=/iphone/i.test(c)&&!p,d=/android/i.test(c)&&!p;return i.prototype={dataAttribute:"data-inputmask",defaults:{placeholder:"_",optionalmarker:{start:"[",end:"]"},quantifiermarker:{start:"{",end:"}"},groupmarker:{start:"(",end:")"},alternatormarker:"|",escapeChar:"\\",mask:null,regex:null,oncomplete:e.noop,onincomplete:e.noop,oncleared:e.noop,repeat:0,greedy:!0,autoUnmask:!1,removeMaskOnSubmit:!1,clearMaskOnLostFocus:!0,insertMode:!0,clearIncomplete:!1,alias:null,onKeyDown:e.noop,onBeforeMask:null,onBeforePaste:function(t,n){return e.isFunction(n.onBeforeMask)?n.onBeforeMask.call(this,t,n):t},onBeforeWrite:null,onUnMask:null,showMaskOnFocus:!0,showMaskOnHover:!0,onKeyValidation:e.noop,skipOptionalPartCharacter:" ",numericInput:!1,rightAlign:!1,undoOnEscape:!0,radixPoint:"",radixPointDefinitionSymbol:a,groupSeparator:"",keepStatic:null,positionCaretOnTab:!0,tabThrough:!1,supportsInputType:["text","tel","password"],ignorables:[8,9,13,19,27,33,34,35,36,37,38,39,40,45,46,93,112,113,114,115,116,117,118,119,120,121,122,123,0,229],isComplete:null,canClearPosition:e.noop,preValidation:null,postValidation:null,staticDefinitionSymbol:a,jitMasking:!1,nullable:!0,inputEventOnly:!1,noValuePatching:!1,positionCaretOnClick:"lvp",casing:null,inputmode:"verbatim",colorMask:!1,androidHack:!1,importDataAttributes:!0},definitions:{9:{validator:"[0-9１-９]",cardinality:1,definitionSymbol:"*"},a:{validator:"[A-Za-zА-яЁёÀ-ÿµ]",cardinality:1,definitionSymbol:"*"},"*":{validator:"[0-9１-９A-Za-zА-яЁёÀ-ÿµ]",cardinality:1}},aliases:{},masksCache:{},mask:function(o){function c(n,i,o,s){if(!0===i.importDataAttributes){var l,c,u,p,f=function(e,i){null!==(i=i!==a?i:n.getAttribute(s+"-"+e))&&("string"==typeof i&&(0===e.indexOf("on")?i=t[i]:"false"===i?i=!1:"true"===i&&(i=!0)),o[e]=i)},d=n.getAttribute(s);if(d&&""!==d&&(d=d.replace(new RegExp("'","g"),'"'),c=JSON.parse("{"+d+"}")),c){u=a;for(p in c)if("alias"===p.toLowerCase()){u=c[p];break}}f("alias",u),o.alias&&r(o.alias,o,i);for(l in i){if(c){u=a;for(p in c)if(p.toLowerCase()===l.toLowerCase()){u=c[p];break}}f(l,u)}}return e.extend(!0,i,o),("rtl"===n.dir||i.rightAlign)&&(n.style.textAlign="right"),("rtl"===n.dir||i.numericInput)&&(n.dir="ltr",n.removeAttribute("dir"),i.isRTL=!0),i}var u=this;return"string"==typeof o&&(o=n.getElementById(o)||n.querySelectorAll(o)),o=o.nodeName?[o]:o,e.each(o,function(t,n){var r=e.extend(!0,{},u.opts);c(n,r,e.extend(!0,{},u.userOptions),u.dataAttribute);var o=s(r,u.noMasksCache);o!==a&&(n.inputmask!==a&&(n.inputmask.opts.autoUnmask=!0,n.inputmask.remove()),n.inputmask=new i(a,a,!0),n.inputmask.opts=r,n.inputmask.noMasksCache=u.noMasksCache,n.inputmask.userOptions=e.extend(!0,{},u.userOptions),n.inputmask.isRTL=r.isRTL||r.numericInput,n.inputmask.el=n,n.inputmask.maskset=o,e.data(n,"_inputmask_opts",r),l.call(n.inputmask,{action:"mask"}))}),o&&o[0]?o[0].inputmask||this:this},option:function(t,n){return"string"==typeof t?this.opts[t]:"object"===(void 0===t?"undefined":o(t))?(e.extend(this.userOptions,t),this.el&&!0!==n&&this.mask(this.el),this):void 0},unmaskedvalue:function(e){return this.maskset=this.maskset||s(this.opts,this.noMasksCache),l.call(this,{action:"unmaskedvalue",value:e})},remove:function(){return l.call(this,{action:"remove"})},getemptymask:function(){return this.maskset=this.maskset||s(this.opts,this.noMasksCache),l.call(this,{action:"getemptymask"})},hasMaskedValue:function(){return!this.opts.autoUnmask},isComplete:function(){return this.maskset=this.maskset||s(this.opts,this.noMasksCache),l.call(this,{action:"isComplete"})},getmetadata:function(){return this.maskset=this.maskset||s(this.opts,this.noMasksCache),l.call(this,{action:"getmetadata"})},isValid:function(e){return this.maskset=this.maskset||s(this.opts,this.noMasksCache),l.call(this,{action:"isValid",value:e})},format:function(e,t){return this.maskset=this.maskset||s(this.opts,this.noMasksCache),l.call(this,{action:"format",value:e,metadata:t})},analyseMask:function(t,n,r){function o(e,t,n,a){this.matches=[],this.openGroup=e||!1,this.alternatorGroup=!1,this.isGroup=e||!1,this.isOptional=t||!1,this.isQuantifier=n||!1,this.isAlternator=a||!1,this.quantifier={min:1,max:1}}function s(t,o,s){s=s!==a?s:t.matches.length;var l=t.matches[s-1];if(n)0===o.indexOf("[")||b&&/\\d|\\s|\\w]/i.test(o)||"."===o?t.matches.splice(s++,0,{fn:new RegExp(o,r.casing?"i":""),cardinality:1,optionality:t.isOptional,newBlockMarker:l===a||l.def!==o,casing:null,def:o,placeholder:a,nativeDef:o}):(b&&(o=o[o.length-1]),e.each(o.split(""),function(e,n){l=t.matches[s-1],t.matches.splice(s++,0,{fn:null,cardinality:0,optionality:t.isOptional,newBlockMarker:l===a||l.def!==n&&null!==l.fn,casing:null,def:r.staticDefinitionSymbol||n,placeholder:r.staticDefinitionSymbol!==a?n:a,nativeDef:n})})),b=!1;else{var c=(r.definitions?r.definitions[o]:a)||i.prototype.definitions[o];if(c&&!b){for(var u=c.prevalidator,p=u?u.length:0,f=1;f<c.cardinality;f++){var d=p>=f?u[f-1]:[],m=d.validator,h=d.cardinality;t.matches.splice(s++,0,{fn:m?"string"==typeof m?new RegExp(m,r.casing?"i":""):new function(){this.test=m}:new RegExp("."),cardinality:h||1,optionality:t.isOptional,newBlockMarker:l===a||l.def!==(c.definitionSymbol||o),casing:c.casing,def:c.definitionSymbol||o,placeholder:c.placeholder,nativeDef:o}),l=t.matches[s-1]}t.matches.splice(s++,0,{fn:c.validator?"string"==typeof c.validator?new RegExp(c.validator,r.casing?"i":""):new function(){this.test=c.validator}:new RegExp("."),cardinality:c.cardinality,optionality:t.isOptional,newBlockMarker:l===a||l.def!==(c.definitionSymbol||o),casing:c.casing,def:c.definitionSymbol||o,placeholder:c.placeholder,nativeDef:o})}else t.matches.splice(s++,0,{fn:null,cardinality:0,optionality:t.isOptional,newBlockMarker:l===a||l.def!==o&&null!==l.fn,casing:null,def:r.staticDefinitionSymbol||o,placeholder:r.staticDefinitionSymbol!==a?o:a,nativeDef:o}),b=!1}}function l(t){t&&t.matches&&e.each(t.matches,function(e,i){var o=t.matches[e+1];(o===a||o.matches===a||!1===o.isQuantifier)&&i&&i.isGroup&&(i.isGroup=!1,n||(s(i,r.groupmarker.start,0),!0!==i.openGroup&&s(i,r.groupmarker.end))),l(i)})}function c(){if(P.length>0){if(m=P[P.length-1],s(m,f),m.isAlternator){h=P.pop();for(var e=0;e<h.matches.length;e++)h.matches[e].isGroup=!1;P.length>0?(m=P[P.length-1]).matches.push(h):x.matches.push(h)}}else s(x,f)}function u(e){e.matches=e.matches.reverse();for(var t in e.matches)if(e.matches.hasOwnProperty(t)){var n=parseInt(t);if(e.matches[t].isQuantifier&&e.matches[n+1]&&e.matches[n+1].isGroup){var i=e.matches[t];e.matches.splice(t,1),e.matches.splice(n+1,0,i)}e.matches[t].matches!==a?e.matches[t]=u(e.matches[t]):e.matches[t]=function(e){return e===r.optionalmarker.start?e=r.optionalmarker.end:e===r.optionalmarker.end?e=r.optionalmarker.start:e===r.groupmarker.start?e=r.groupmarker.end:e===r.groupmarker.end&&(e=r.groupmarker.start),e}(e.matches[t])}return e}var p,f,d,m,h,g,v,y=/(?:[?*+]|\{[0-9\+\*]+(?:,[0-9\+\*]*)?\})|[^.?*+^${[]()|\\]+|./g,k=/\[\^?]?(?:[^\\\]]+|\\[\S\s]?)*]?|\\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9][0-9]*|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|c[A-Za-z]|[\S\s]?)|\((?:\?[:=!]?)?|(?:[?*+]|\{[0-9]+(?:,[0-9]*)?\})\??|[^.?*+^${[()|\\]+|./g,b=!1,x=new o,P=[],S=[];for(n&&(r.optionalmarker.start=a,r.optionalmarker.end=a);p=n?k.exec(t):y.exec(t);){if(f=p[0],n)switch(f.charAt(0)){case"?":f="{0,1}";break;case"+":case"*":f="{"+f+"}"}if(b)c();else switch(f.charAt(0)){case r.escapeChar:b=!0,n&&c();break;case r.optionalmarker.end:case r.groupmarker.end:if(d=P.pop(),d.openGroup=!1,d!==a)if(P.length>0){if((m=P[P.length-1]).matches.push(d),m.isAlternator){h=P.pop();for(var w=0;w<h.matches.length;w++)h.matches[w].isGroup=!1,h.matches[w].alternatorGroup=!1;P.length>0?(m=P[P.length-1]).matches.push(h):x.matches.push(h)}}else x.matches.push(d);else c();break;case r.optionalmarker.start:P.push(new o(!1,!0));break;case r.groupmarker.start:P.push(new o(!0));break;case r.quantifiermarker.start:var A=new o(!1,!1,!0),E=(f=f.replace(/[{}]/g,"")).split(","),C=isNaN(E[0])?E[0]:parseInt(E[0]),O=1===E.length?C:isNaN(E[1])?E[1]:parseInt(E[1]);if("*"!==O&&"+"!==O||(C="*"===O?0:1),A.quantifier={min:C,max:O},P.length>0){var R=P[P.length-1].matches;(p=R.pop()).isGroup||((v=new o(!0)).matches.push(p),p=v),R.push(p),R.push(A)}else(p=x.matches.pop()).isGroup||(n&&null===p.fn&&"."===p.def&&(p.fn=new RegExp(p.def,r.casing?"i":"")),(v=new o(!0)).matches.push(p),p=v),x.matches.push(p),x.matches.push(A);break;case r.alternatormarker:if(P.length>0){var M=(m=P[P.length-1]).matches[m.matches.length-1];g=m.openGroup&&(M.matches===a||!1===M.isGroup&&!1===M.isAlternator)?P.pop():m.matches.pop()}else g=x.matches.pop();if(g.isAlternator)P.push(g);else if(g.alternatorGroup?(h=P.pop(),g.alternatorGroup=!1):h=new o(!1,!1,!1,!0),h.matches.push(g),P.push(h),g.openGroup){g.openGroup=!1;var _=new o(!0);_.alternatorGroup=!0,P.push(_)}break;default:c()}}for(;P.length>0;)d=P.pop(),x.matches.push(d);return x.matches.length>0&&(l(x),S.push(x)),(r.numericInput||r.isRTL)&&u(S[0]),S}},i.extendDefaults=function(t){e.extend(!0,i.prototype.defaults,t)},i.extendDefinitions=function(t){e.extend(!0,i.prototype.definitions,t)},i.extendAliases=function(t){e.extend(!0,i.prototype.aliases,t)},i.format=function(e,t,n){return i(t).format(e,n)},i.unmask=function(e,t){return i(t).unmaskedvalue(e)},i.isValid=function(e,t){return i(t).isValid(e)},i.remove=function(t){e.each(t,function(e,t){t.inputmask&&t.inputmask.remove()})},i.escapeRegex=function(e){var t=["/",".","*","+","?","|","(",")","[","]","{","}","\\","$","^"];return e.replace(new RegExp("(\\"+t.join("|\\")+")","gim"),"\\$1")},i.keyCode={ALT:18,BACKSPACE:8,BACKSPACE_SAFARI:127,CAPS_LOCK:20,COMMA:188,COMMAND:91,COMMAND_LEFT:91,COMMAND_RIGHT:93,CONTROL:17,DELETE:46,DOWN:40,END:35,ENTER:13,ESCAPE:27,HOME:36,INSERT:45,LEFT:37,MENU:93,NUMPAD_ADD:107,NUMPAD_DECIMAL:110,NUMPAD_DIVIDE:111,NUMPAD_ENTER:108,NUMPAD_MULTIPLY:106,NUMPAD_SUBTRACT:109,PAGE_DOWN:34,PAGE_UP:33,PERIOD:190,RIGHT:39,SHIFT:16,SPACE:32,TAB:9,UP:38,WINDOWS:91,X:88},i})},function(e,t){e.exports=jQuery},function(e,t,n){"use strict";function a(e){return e&&e.__esModule?e:{default:e}}n(4),n(9),n(12),n(13),n(14),n(15);var i=a(n(1)),r=a(n(0)),o=a(n(2));r.default===o.default&&n(16),window.Inputmask=i.default},function(e,t,n){var a=n(5);"string"==typeof a&&(a=[[e.i,a,""]]);var i={hmr:!0};i.transform=void 0;n(7)(a,i);a.locals&&(e.exports=a.locals)},function(e,t,n){(e.exports=n(6)(void 0)).push([e.i,"span.im-caret {\r\n    -webkit-animation: 1s blink step-end infinite;\r\n    animation: 1s blink step-end infinite;\r\n}\r\n\r\n@keyframes blink {\r\n    from, to {\r\n        border-right-color: black;\r\n    }\r\n    50% {\r\n        border-right-color: transparent;\r\n    }\r\n}\r\n\r\n@-webkit-keyframes blink {\r\n    from, to {\r\n        border-right-color: black;\r\n    }\r\n    50% {\r\n        border-right-color: transparent;\r\n    }\r\n}\r\n\r\nspan.im-static {\r\n    color: grey;\r\n}\r\n\r\ndiv.im-colormask {\r\n    display: inline-block;\r\n    border-style: inset;\r\n    border-width: 2px;\r\n    -webkit-appearance: textfield;\r\n    -moz-appearance: textfield;\r\n    appearance: textfield;\r\n}\r\n\r\ndiv.im-colormask > input {\r\n    position: absolute;\r\n    display: inline-block;\r\n    background-color: transparent;\r\n    color: transparent;\r\n    -webkit-appearance: caret;\r\n    -moz-appearance: caret;\r\n    appearance: caret;\r\n    border-style: none;\r\n    left: 0; /*calculated*/\r\n}\r\n\r\ndiv.im-colormask > input:focus {\r\n    outline: none;\r\n}\r\n\r\ndiv.im-colormask > input::-moz-selection{\r\n    background: none;\r\n}\r\n\r\ndiv.im-colormask > input::selection{\r\n    background: none;\r\n}\r\ndiv.im-colormask > input::-moz-selection{\r\n    background: none;\r\n}\r\n\r\ndiv.im-colormask > div {\r\n    color: black;\r\n    display: inline-block;\r\n    width: 100px; /*calculated*/\r\n}",""])},function(e,t){function n(e,t){var n=e[1]||"",i=e[3];if(!i)return n;if(t&&"function"==typeof btoa){var r=a(i),o=i.sources.map(function(e){return"/*# sourceURL="+i.sourceRoot+e+" */"});return[n].concat(o).concat([r]).join("\n")}return[n].join("\n")}function a(e){return"/*# "+("sourceMappingURL=data:application/json;charset=utf-8;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(e)))))+" */"}e.exports=function(e){var t=[];return t.toString=function(){return this.map(function(t){var a=n(t,e);return t[2]?"@media "+t[2]+"{"+a+"}":a}).join("")},t.i=function(e,n){"string"==typeof e&&(e=[[null,e,""]]);for(var a={},i=0;i<this.length;i++){var r=this[i][0];"number"==typeof r&&(a[r]=!0)}for(i=0;i<e.length;i++){var o=e[i];"number"==typeof o[0]&&a[o[0]]||(n&&!o[2]?o[2]=n:n&&(o[2]="("+o[2]+") and ("+n+")"),t.push(o))}},t}},function(e,t,n){function a(e,t){for(var n=0;n<e.length;n++){var a=e[n],i=m[a.id];if(i){i.refs++;for(o=0;o<i.parts.length;o++)i.parts[o](a.parts[o]);for(;o<a.parts.length;o++)i.parts.push(u(a.parts[o],t))}else{for(var r=[],o=0;o<a.parts.length;o++)r.push(u(a.parts[o],t));m[a.id]={id:a.id,refs:1,parts:r}}}}function i(e,t){for(var n=[],a={},i=0;i<e.length;i++){var r=e[i],o=t.base?r[0]+t.base:r[0],s={css:r[1],media:r[2],sourceMap:r[3]};a[o]?a[o].parts.push(s):n.push(a[o]={id:o,parts:[s]})}return n}function r(e,t){var n=g(e.insertInto);if(!n)throw new Error("Couldn't find a style target. This probably means that the value for the 'insertInto' parameter is invalid.");var a=k[k.length-1];if("top"===e.insertAt)a?a.nextSibling?n.insertBefore(t,a.nextSibling):n.appendChild(t):n.insertBefore(t,n.firstChild),k.push(t);else if("bottom"===e.insertAt)n.appendChild(t);else{if("object"!=typeof e.insertAt||!e.insertAt.before)throw new Error("[Style Loader]\n\n Invalid value for parameter 'insertAt' ('options.insertAt') found.\n Must be 'top', 'bottom', or Object.\n (https://github.com/webpack-contrib/style-loader#insertat)\n");var i=g(e.insertInto+" "+e.insertAt.before);n.insertBefore(t,i)}}function o(e){if(null===e.parentNode)return!1;e.parentNode.removeChild(e);var t=k.indexOf(e);t>=0&&k.splice(t,1)}function s(e){var t=document.createElement("style");return e.attrs.type="text/css",c(t,e.attrs),r(e,t),t}function l(e){var t=document.createElement("link");return e.attrs.type="text/css",e.attrs.rel="stylesheet",c(t,e.attrs),r(e,t),t}function c(e,t){Object.keys(t).forEach(function(n){e.setAttribute(n,t[n])})}function u(e,t){var n,a,i,r;if(t.transform&&e.css){if(!(r=t.transform(e.css)))return function(){};e.css=r}if(t.singleton){var c=y++;n=v||(v=s(t)),a=p.bind(null,n,c,!1),i=p.bind(null,n,c,!0)}else e.sourceMap&&"function"==typeof URL&&"function"==typeof URL.createObjectURL&&"function"==typeof URL.revokeObjectURL&&"function"==typeof Blob&&"function"==typeof btoa?(n=l(t),a=d.bind(null,n,t),i=function(){o(n),n.href&&URL.revokeObjectURL(n.href)}):(n=s(t),a=f.bind(null,n),i=function(){o(n)});return a(e),function(t){if(t){if(t.css===e.css&&t.media===e.media&&t.sourceMap===e.sourceMap)return;a(e=t)}else i()}}function p(e,t,n,a){var i=n?"":a.css;if(e.styleSheet)e.styleSheet.cssText=x(t,i);else{var r=document.createTextNode(i),o=e.childNodes;o[t]&&e.removeChild(o[t]),o.length?e.insertBefore(r,o[t]):e.appendChild(r)}}function f(e,t){var n=t.css,a=t.media;if(a&&e.setAttribute("media",a),e.styleSheet)e.styleSheet.cssText=n;else{for(;e.firstChild;)e.removeChild(e.firstChild);e.appendChild(document.createTextNode(n))}}function d(e,t,n){var a=n.css,i=n.sourceMap,r=void 0===t.convertToAbsoluteUrls&&i;(t.convertToAbsoluteUrls||r)&&(a=b(a)),i&&(a+="\n/*# sourceMappingURL=data:application/json;base64,"+btoa(unescape(encodeURIComponent(JSON.stringify(i))))+" */");var o=new Blob([a],{type:"text/css"}),s=e.href;e.href=URL.createObjectURL(o),s&&URL.revokeObjectURL(s)}var m={},h=function(e){var t;return function(){return void 0===t&&(t=e.apply(this,arguments)),t}}(function(){return window&&document&&document.all&&!window.atob}),g=function(e){var t={};return function(n){if(void 0===t[n]){var a=e.call(this,n);if(a instanceof window.HTMLIFrameElement)try{a=a.contentDocument.head}catch(e){a=null}t[n]=a}return t[n]}}(function(e){return document.querySelector(e)}),v=null,y=0,k=[],b=n(8);e.exports=function(e,t){if("undefined"!=typeof DEBUG&&DEBUG&&"object"!=typeof document)throw new Error("The style-loader cannot be used in a non-browser environment");(t=t||{}).attrs="object"==typeof t.attrs?t.attrs:{},t.singleton||(t.singleton=h()),t.insertInto||(t.insertInto="head"),t.insertAt||(t.insertAt="bottom");var n=i(e,t);return a(n,t),function(e){for(var r=[],o=0;o<n.length;o++){var s=n[o];(l=m[s.id]).refs--,r.push(l)}e&&a(i(e,t),t);for(o=0;o<r.length;o++){var l=r[o];if(0===l.refs){for(var c=0;c<l.parts.length;c++)l.parts[c]();delete m[l.id]}}}};var x=function(){var e=[];return function(t,n){return e[t]=n,e.filter(Boolean).join("\n")}}()},function(e,t){e.exports=function(e){var t="undefined"!=typeof window&&window.location;if(!t)throw new Error("fixUrls requires window.location");if(!e||"string"!=typeof e)return e;var n=t.protocol+"//"+t.host,a=n+t.pathname.replace(/\/[^\/]*$/,"/");return e.replace(/url\s*\(((?:[^)(]|\((?:[^)(]+|\([^)(]*\))*\))*)\)/gi,function(e,t){var i=t.trim().replace(/^"(.*)"$/,function(e,t){return t}).replace(/^'(.*)'$/,function(e,t){return t});if(/^(#|data:|http:\/\/|https:\/\/|file:\/\/\/)/i.test(i))return e;var r;return r=0===i.indexOf("//")?i:0===i.indexOf("/")?n+i:a+i.replace(/^\.\//,""),"url("+JSON.stringify(r)+")"})}},function(e,t,n){"use strict";var a,i,r;"function"==typeof Symbol&&Symbol.iterator;!function(o){i=[n(0),n(1)],void 0!==(r="function"==typeof(a=o)?a.apply(t,i):a)&&(e.exports=r)}(function(e,t){function n(e){return isNaN(e)||29===new Date(e,2,0).getDate()}return t.extendAliases({"dd/mm/yyyy":{mask:"1/2/y",placeholder:"dd/mm/yyyy",regex:{val1pre:new RegExp("[0-3]"),val1:new RegExp("0[1-9]|[12][0-9]|3[01]"),val2pre:function(e){var n=t.escapeRegex.call(this,e);return new RegExp("((0[1-9]|[12][0-9]|3[01])"+n+"[01])")},val2:function(e){var n=t.escapeRegex.call(this,e);return new RegExp("((0[1-9]|[12][0-9])"+n+"(0[1-9]|1[012]))|(30"+n+"(0[13-9]|1[012]))|(31"+n+"(0[13578]|1[02]))")}},leapday:"29/02/",separator:"/",yearrange:{minyear:1900,maxyear:2099},isInYearRange:function(e,t,n){if(isNaN(e))return!1;var a=parseInt(e.concat(t.toString().slice(e.length))),i=parseInt(e.concat(n.toString().slice(e.length)));return!isNaN(a)&&(t<=a&&a<=n)||!isNaN(i)&&(t<=i&&i<=n)},determinebaseyear:function(e,t,n){var a=(new Date).getFullYear();if(e>a)return e;if(t<a){for(var i=t.toString().slice(0,2),r=t.toString().slice(2,4);t<i+n;)i--;var o=i+r;return e>o?e:o}if(e<=a&&a<=t){for(var s=a.toString().slice(0,2);t<s+n;)s--;var l=s+n;return l<e?e:l}return a},onKeyDown:function(n,a,i,r){var o=e(this);if(n.ctrlKey&&n.keyCode===t.keyCode.RIGHT){var s=new Date;o.val(s.getDate().toString()+(s.getMonth()+1).toString()+s.getFullYear().toString()),o.trigger("setvalue")}},getFrontValue:function(e,t,n){for(var a=0,i=0,r=0;r<e.length&&"2"!==e.charAt(r);r++){var o=n.definitions[e.charAt(r)];o?(a+=i,i=o.cardinality):i++}return t.join("").substr(a,i)},postValidation:function(e,t,a){var i,r,o=e.join("");return 0===a.mask.indexOf("y")?(r=o.substr(0,4),i=o.substring(4,10)):(r=o.substring(6,10),i=o.substr(0,6)),t&&(i!==a.leapday||n(r))},definitions:{1:{validator:function(e,t,n,a,i){var r=i.regex.val1.test(e);return a||r||e.charAt(1)!==i.separator&&-1==="-./".indexOf(e.charAt(1))||!(r=i.regex.val1.test("0"+e.charAt(0)))?r:(t.buffer[n-1]="0",{refreshFromBuffer:{start:n-1,end:n},pos:n,c:e.charAt(0)})},cardinality:2,prevalidator:[{validator:function(e,t,n,a,i){var r=e;isNaN(t.buffer[n+1])||(r+=t.buffer[n+1]);var o=1===r.length?i.regex.val1pre.test(r):i.regex.val1.test(r);if(o&&t.validPositions[n]&&(i.regex.val2(i.separator).test(e+t.validPositions[n].input)||(t.validPositions[n].input="0"===e?"1":"0")),!a&&!o){if(o=i.regex.val1.test(e+"0"))return t.buffer[n]=e,t.buffer[++n]="0",{pos:n,c:"0"};if(o=i.regex.val1.test("0"+e))return t.buffer[n]="0",n++,{pos:n}}return o},cardinality:1}]},2:{validator:function(e,t,n,a,i){var r=i.getFrontValue(t.mask,t.buffer,i);-1!==r.indexOf(i.placeholder[0])&&(r="01"+i.separator);var o=i.regex.val2(i.separator).test(r+e);return a||o||e.charAt(1)!==i.separator&&-1==="-./".indexOf(e.charAt(1))||!(o=i.regex.val2(i.separator).test(r+"0"+e.charAt(0)))?o:(t.buffer[n-1]="0",{refreshFromBuffer:{start:n-1,end:n},pos:n,c:e.charAt(0)})},cardinality:2,prevalidator:[{validator:function(e,t,n,a,i){isNaN(t.buffer[n+1])||(e+=t.buffer[n+1]);var r=i.getFrontValue(t.mask,t.buffer,i);-1!==r.indexOf(i.placeholder[0])&&(r="01"+i.separator);var o=1===e.length?i.regex.val2pre(i.separator).test(r+e):i.regex.val2(i.separator).test(r+e);return o&&t.validPositions[n]&&(i.regex.val2(i.separator).test(e+t.validPositions[n].input)||(t.validPositions[n].input="0"===e?"1":"0")),a||o||!(o=i.regex.val2(i.separator).test(r+"0"+e))?o:(t.buffer[n]="0",n++,{pos:n})},cardinality:1}]},y:{validator:function(e,t,n,a,i){return i.isInYearRange(e,i.yearrange.minyear,i.yearrange.maxyear)},cardinality:4,prevalidator:[{validator:function(e,t,n,a,i){var r=i.isInYearRange(e,i.yearrange.minyear,i.yearrange.maxyear);if(!a&&!r){var o=i.determinebaseyear(i.yearrange.minyear,i.yearrange.maxyear,e+"0").toString().slice(0,1);if(r=i.isInYearRange(o+e,i.yearrange.minyear,i.yearrange.maxyear))return t.buffer[n++]=o.charAt(0),{pos:n};if(o=i.determinebaseyear(i.yearrange.minyear,i.yearrange.maxyear,e+"0").toString().slice(0,2),r=i.isInYearRange(o+e,i.yearrange.minyear,i.yearrange.maxyear))return t.buffer[n++]=o.charAt(0),t.buffer[n++]=o.charAt(1),{pos:n}}return r},cardinality:1},{validator:function(e,t,n,a,i){var r=i.isInYearRange(e,i.yearrange.minyear,i.yearrange.maxyear);if(!a&&!r){var o=i.determinebaseyear(i.yearrange.minyear,i.yearrange.maxyear,e).toString().slice(0,2);if(r=i.isInYearRange(e[0]+o[1]+e[1],i.yearrange.minyear,i.yearrange.maxyear))return t.buffer[n++]=o.charAt(1),{pos:n};if(o=i.determinebaseyear(i.yearrange.minyear,i.yearrange.maxyear,e).toString().slice(0,2),r=i.isInYearRange(o+e,i.yearrange.minyear,i.yearrange.maxyear))return t.buffer[n-1]=o.charAt(0),t.buffer[n++]=o.charAt(1),t.buffer[n++]=e.charAt(0),{refreshFromBuffer:{start:n-3,end:n},pos:n}}return r},cardinality:2},{validator:function(e,t,n,a,i){return i.isInYearRange(e,i.yearrange.minyear,i.yearrange.maxyear)},cardinality:3}]}},insertMode:!1,autoUnmask:!1},"mm/dd/yyyy":{placeholder:"mm/dd/yyyy",alias:"dd/mm/yyyy",regex:{val2pre:function(e){var n=t.escapeRegex.call(this,e);return new RegExp("((0[13-9]|1[012])"+n+"[0-3])|(02"+n+"[0-2])")},val2:function(e){var n=t.escapeRegex.call(this,e);return new RegExp("((0[1-9]|1[012])"+n+"(0[1-9]|[12][0-9]))|((0[13-9]|1[012])"+n+"30)|((0[13578]|1[02])"+n+"31)")},val1pre:new RegExp("[01]"),val1:new RegExp("0[1-9]|1[012]")},leapday:"02/29/",onKeyDown:function(n,a,i,r){var o=e(this);if(n.ctrlKey&&n.keyCode===t.keyCode.RIGHT){var s=new Date;o.val((s.getMonth()+1).toString()+s.getDate().toString()+s.getFullYear().toString()),o.trigger("setvalue")}}},"yyyy/mm/dd":{mask:"y/1/2",placeholder:"yyyy/mm/dd",alias:"mm/dd/yyyy",leapday:"/02/29",onKeyDown:function(n,a,i,r){var o=e(this);if(n.ctrlKey&&n.keyCode===t.keyCode.RIGHT){var s=new Date;o.val(s.getFullYear().toString()+(s.getMonth()+1).toString()+s.getDate().toString()),o.trigger("setvalue")}}},"dd.mm.yyyy":{mask:"1.2.y",placeholder:"dd.mm.yyyy",leapday:"29.02.",separator:".",alias:"dd/mm/yyyy"},"dd-mm-yyyy":{mask:"1-2-y",placeholder:"dd-mm-yyyy",leapday:"29-02-",separator:"-",alias:"dd/mm/yyyy"},"mm.dd.yyyy":{mask:"1.2.y",placeholder:"mm.dd.yyyy",leapday:"02.29.",separator:".",alias:"mm/dd/yyyy"},"mm-dd-yyyy":{mask:"1-2-y",placeholder:"mm-dd-yyyy",leapday:"02-29-",separator:"-",alias:"mm/dd/yyyy"},"yyyy.mm.dd":{mask:"y.1.2",placeholder:"yyyy.mm.dd",leapday:".02.29",separator:".",alias:"yyyy/mm/dd"},"yyyy-mm-dd":{mask:"y-1-2",placeholder:"yyyy-mm-dd",leapday:"-02-29",separator:"-",alias:"yyyy/mm/dd"},datetime:{mask:"1/2/y h:s",placeholder:"dd/mm/yyyy hh:mm",alias:"dd/mm/yyyy",regex:{hrspre:new RegExp("[012]"),hrs24:new RegExp("2[0-4]|1[3-9]"),hrs:new RegExp("[01][0-9]|2[0-4]"),ampm:new RegExp("^[a|p|A|P][m|M]"),mspre:new RegExp("[0-5]"),ms:new RegExp("[0-5][0-9]")},timeseparator:":",hourFormat:"24",definitions:{h:{validator:function(e,t,n,a,i){if("24"===i.hourFormat&&24===parseInt(e,10))return t.buffer[n-1]="0",t.buffer[n]="0",{refreshFromBuffer:{start:n-1,end:n},c:"0"};var r=i.regex.hrs.test(e);if(!a&&!r&&(e.charAt(1)===i.timeseparator||-1!=="-.:".indexOf(e.charAt(1)))&&(r=i.regex.hrs.test("0"+e.charAt(0))))return t.buffer[n-1]="0",t.buffer[n]=e.charAt(0),n++,{refreshFromBuffer:{start:n-2,end:n},pos:n,c:i.timeseparator};if(r&&"24"!==i.hourFormat&&i.regex.hrs24.test(e)){var o=parseInt(e,10);return 24===o?(t.buffer[n+5]="a",t.buffer[n+6]="m"):(t.buffer[n+5]="p",t.buffer[n+6]="m"),(o-=12)<10?(t.buffer[n]=o.toString(),t.buffer[n-1]="0"):(t.buffer[n]=o.toString().charAt(1),t.buffer[n-1]=o.toString().charAt(0)),{refreshFromBuffer:{start:n-1,end:n+6},c:t.buffer[n]}}return r},cardinality:2,prevalidator:[{validator:function(e,t,n,a,i){var r=i.regex.hrspre.test(e);return a||r||!(r=i.regex.hrs.test("0"+e))?r:(t.buffer[n]="0",n++,{pos:n})},cardinality:1}]},s:{validator:"[0-5][0-9]",cardinality:2,prevalidator:[{validator:function(e,t,n,a,i){var r=i.regex.mspre.test(e);return a||r||!(r=i.regex.ms.test("0"+e))?r:(t.buffer[n]="0",n++,{pos:n})},cardinality:1}]},t:{validator:function(e,t,n,a,i){return i.regex.ampm.test(e+"m")},casing:"lower",cardinality:1}},insertMode:!1,autoUnmask:!1},datetime12:{mask:"1/2/y h:s t\\m",placeholder:"dd/mm/yyyy hh:mm xm",alias:"datetime",hourFormat:"12"},"mm/dd/yyyy hh:mm xm":{mask:"1/2/y h:s t\\m",placeholder:"mm/dd/yyyy hh:mm xm",alias:"datetime12",regex:{val2pre:function(e){var n=t.escapeRegex.call(this,e);return new RegExp("((0[13-9]|1[012])"+n+"[0-3])|(02"+n+"[0-2])")},val2:function(e){var n=t.escapeRegex.call(this,e);return new RegExp("((0[1-9]|1[012])"+n+"(0[1-9]|[12][0-9]))|((0[13-9]|1[012])"+n+"30)|((0[13578]|1[02])"+n+"31)")},val1pre:new RegExp("[01]"),val1:new RegExp("0[1-9]|1[012]")},leapday:"02/29/",onKeyDown:function(n,a,i,r){var o=e(this);if(n.ctrlKey&&n.keyCode===t.keyCode.RIGHT){var s=new Date;o.val((s.getMonth()+1).toString()+s.getDate().toString()+s.getFullYear().toString()),o.trigger("setvalue")}}},"hh:mm t":{mask:"h:s t\\m",placeholder:"hh:mm xm",alias:"datetime",hourFormat:"12"},"h:s t":{mask:"h:s t\\m",placeholder:"hh:mm xm",alias:"datetime",hourFormat:"12"},"hh:mm:ss":{mask:"h:s:s",placeholder:"hh:mm:ss",alias:"datetime",autoUnmask:!1},"hh:mm":{mask:"h:s",placeholder:"hh:mm",alias:"datetime",autoUnmask:!1},date:{alias:"dd/mm/yyyy"},"mm/yyyy":{mask:"1/y",placeholder:"mm/yyyy",leapday:"donotuse",separator:"/",alias:"mm/dd/yyyy"},shamsi:{regex:{val2pre:function(e){var n=t.escapeRegex.call(this,e);return new RegExp("((0[1-9]|1[012])"+n+"[0-3])")},val2:function(e){var n=t.escapeRegex.call(this,e);return new RegExp("((0[1-9]|1[012])"+n+"(0[1-9]|[12][0-9]))|((0[1-9]|1[012])"+n+"30)|((0[1-6])"+n+"31)")},val1pre:new RegExp("[01]"),val1:new RegExp("0[1-9]|1[012]")},yearrange:{minyear:1300,maxyear:1499},mask:"y/1/2",leapday:"/12/30",placeholder:"yyyy/mm/dd",alias:"mm/dd/yyyy",clearIncomplete:!0},"yyyy-mm-dd hh:mm:ss":{mask:"y-1-2 h:s:s",placeholder:"yyyy-mm-dd hh:mm:ss",alias:"datetime",separator:"-",leapday:"-02-29",regex:{val2pre:function(e){var n=t.escapeRegex.call(this,e);return new RegExp("((0[13-9]|1[012])"+n+"[0-3])|(02"+n+"[0-2])")},val2:function(e){var n=t.escapeRegex.call(this,e);return new RegExp("((0[1-9]|1[012])"+n+"(0[1-9]|[12][0-9]))|((0[13-9]|1[012])"+n+"30)|((0[13578]|1[02])"+n+"31)")},val1pre:new RegExp("[01]"),val1:new RegExp("0[1-9]|1[012]")},onKeyDown:function(e,t,n,a){}}}),t})},function(e,t,n){"use strict";var a;"function"==typeof Symbol&&Symbol.iterator;void 0!==(a=function(){return window}.call(t,n,t,e))&&(e.exports=a)},function(e,t,n){"use strict";var a;"function"==typeof Symbol&&Symbol.iterator;void 0!==(a=function(){return document}.call(t,n,t,e))&&(e.exports=a)},function(e,t,n){"use strict";var a,i,r;"function"==typeof Symbol&&Symbol.iterator;!function(o){i=[n(0),n(1)],void 0!==(r="function"==typeof(a=o)?a.apply(t,i):a)&&(e.exports=r)}(function(e,t){return t.extendDefinitions({A:{validator:"[A-Za-zА-яЁёÀ-ÿµ]",cardinality:1,casing:"upper"},"&":{validator:"[0-9A-Za-zА-яЁёÀ-ÿµ]",cardinality:1,casing:"upper"},"#":{validator:"[0-9A-Fa-f]",cardinality:1,casing:"upper"}}),t.extendAliases({url:{definitions:{i:{validator:".",cardinality:1}},mask:"(\\http://)|(\\http\\s://)|(ftp://)|(ftp\\s://)i{+}",insertMode:!1,autoUnmask:!1,inputmode:"url"},ip:{mask:"i[i[i]].i[i[i]].i[i[i]].i[i[i]]",definitions:{i:{validator:function(e,t,n,a,i){return n-1>-1&&"."!==t.buffer[n-1]?(e=t.buffer[n-1]+e,e=n-2>-1&&"."!==t.buffer[n-2]?t.buffer[n-2]+e:"0"+e):e="00"+e,new RegExp("25[0-5]|2[0-4][0-9]|[01][0-9][0-9]").test(e)},cardinality:1}},onUnMask:function(e,t,n){return e},inputmode:"numeric"},email:{mask:"*{1,64}[.*{1,64}][.*{1,64}][.*{1,63}]@-{1,63}.-{1,63}[.-{1,63}][.-{1,63}]",greedy:!1,onBeforePaste:function(e,t){return(e=e.toLowerCase()).replace("mailto:","")},definitions:{"*":{validator:"[0-9A-Za-z!#$%&'*+/=?^_`{|}~-]",cardinality:1,casing:"lower"},"-":{validator:"[0-9A-Za-z-]",cardinality:1,casing:"lower"}},onUnMask:function(e,t,n){return e},inputmode:"email"},mac:{mask:"##:##:##:##:##:##"},vin:{mask:"V{13}9{4}",definitions:{V:{validator:"[A-HJ-NPR-Za-hj-npr-z\\d]",cardinality:1,casing:"upper"}},clearIncomplete:!0,autoUnmask:!0}}),t})},function(e,t,n){"use strict";var a,i,r;"function"==typeof Symbol&&Symbol.iterator;!function(o){i=[n(0),n(1)],void 0!==(r="function"==typeof(a=o)?a.apply(t,i):a)&&(e.exports=r)}(function(e,t,n){function a(e,n){for(var a="",i=0;i<e.length;i++)t.prototype.definitions[e.charAt(i)]||n.definitions[e.charAt(i)]||n.optionalmarker.start===e.charAt(i)||n.optionalmarker.end===e.charAt(i)||n.quantifiermarker.start===e.charAt(i)||n.quantifiermarker.end===e.charAt(i)||n.groupmarker.start===e.charAt(i)||n.groupmarker.end===e.charAt(i)||n.alternatormarker===e.charAt(i)?a+="\\"+e.charAt(i):a+=e.charAt(i);return a}return t.extendAliases({numeric:{mask:function(e){if(0!==e.repeat&&isNaN(e.integerDigits)&&(e.integerDigits=e.repeat),e.repeat=0,e.groupSeparator===e.radixPoint&&("."===e.radixPoint?e.groupSeparator=",":","===e.radixPoint?e.groupSeparator=".":e.groupSeparator="")," "===e.groupSeparator&&(e.skipOptionalPartCharacter=n),e.autoGroup=e.autoGroup&&""!==e.groupSeparator,e.autoGroup&&("string"==typeof e.groupSize&&isFinite(e.groupSize)&&(e.groupSize=parseInt(e.groupSize)),isFinite(e.integerDigits))){var t=Math.floor(e.integerDigits/e.groupSize),i=e.integerDigits%e.groupSize;e.integerDigits=parseInt(e.integerDigits)+(0===i?t-1:t),e.integerDigits<1&&(e.integerDigits="*")}e.placeholder.length>1&&(e.placeholder=e.placeholder.charAt(0)),"radixFocus"===e.positionCaretOnClick&&""===e.placeholder&&!1===e.integerOptional&&(e.positionCaretOnClick="lvp"),e.definitions[";"]=e.definitions["~"],e.definitions[";"].definitionSymbol="~",!0===e.numericInput&&(e.positionCaretOnClick="radixFocus"===e.positionCaretOnClick?"lvp":e.positionCaretOnClick,e.digitsOptional=!1,isNaN(e.digits)&&(e.digits=2),e.decimalProtect=!1);var r="[+]";if(r+=a(e.prefix,e),!0===e.integerOptional?r+="~{1,"+e.integerDigits+"}":r+="~{"+e.integerDigits+"}",e.digits!==n){e.radixPointDefinitionSymbol=e.decimalProtect?":":e.radixPoint;var o=e.digits.toString().split(",");isFinite(o[0]&&o[1]&&isFinite(o[1]))?r+=e.radixPointDefinitionSymbol+";{"+e.digits+"}":(isNaN(e.digits)||parseInt(e.digits)>0)&&(e.digitsOptional?r+="["+e.radixPointDefinitionSymbol+";{1,"+e.digits+"}]":r+=e.radixPointDefinitionSymbol+";{"+e.digits+"}")}return r+=a(e.suffix,e),r+="[-]",e.greedy=!1,r},placeholder:"",greedy:!1,digits:"*",digitsOptional:!0,enforceDigitsOnBlur:!1,radixPoint:".",positionCaretOnClick:"radixFocus",groupSize:3,groupSeparator:"",autoGroup:!1,allowMinus:!0,negationSymbol:{front:"-",back:""},integerDigits:"+",integerOptional:!0,prefix:"",suffix:"",rightAlign:!0,decimalProtect:!0,min:null,max:null,step:1,insertMode:!0,autoUnmask:!1,unmaskAsNumber:!1,inputmode:"numeric",preValidation:function(t,a,i,r,o){if("-"===i||i===o.negationSymbol.front)return!0===o.allowMinus&&(o.isNegative=o.isNegative===n||!o.isNegative,""===t.join("")||{caret:a,dopost:!0});if(!1===r&&i===o.radixPoint&&o.digits!==n&&(isNaN(o.digits)||parseInt(o.digits)>0)){var s=e.inArray(o.radixPoint,t);if(-1!==s)return!0===o.numericInput?a===s:{caret:s+1}}return!0},postValidation:function(a,i,r){var o=r.suffix.split(""),s=r.prefix.split("");if(i.pos===n&&i.caret!==n&&!0!==i.dopost)return i;var l=i.caret!==n?i.caret:i.pos,c=a.slice();r.numericInput&&(l=c.length-l-1,c=c.reverse());var u=c[l];if(u===r.groupSeparator&&(u=c[l+=1]),l===c.length-r.suffix.length-1&&u===r.radixPoint)return i;u!==n&&u!==r.radixPoint&&u!==r.negationSymbol.front&&u!==r.negationSymbol.back&&(c[l]="?",r.prefix.length>0&&l>=(!1===r.isNegative?1:0)&&l<r.prefix.length-1+(!1===r.isNegative?1:0)?s[l-(!1===r.isNegative?1:0)]="?":r.suffix.length>0&&l>=c.length-r.suffix.length-(!1===r.isNegative?1:0)&&(o[l-(c.length-r.suffix.length-(!1===r.isNegative?1:0))]="?")),s=s.join(""),o=o.join("");var p=c.join("").replace(s,"");if(p=p.replace(o,""),p=p.replace(new RegExp(t.escapeRegex(r.groupSeparator),"g"),""),p=p.replace(new RegExp("[-"+t.escapeRegex(r.negationSymbol.front)+"]","g"),""),p=p.replace(new RegExp(t.escapeRegex(r.negationSymbol.back)+"$"),""),isNaN(r.placeholder)&&(p=p.replace(new RegExp(t.escapeRegex(r.placeholder),"g"),"")),p.length>1&&1!==p.indexOf(r.radixPoint)&&("0"===u&&(p=p.replace(/^\?/g,"")),p=p.replace(/^0/g,"")),p.charAt(0)===r.radixPoint&&""!==r.radixPoint&&!0!==r.numericInput&&(p="0"+p),""!==p){if(p=p.split(""),(!r.digitsOptional||r.enforceDigitsOnBlur&&"blur"===i.event)&&isFinite(r.digits)){var f=e.inArray(r.radixPoint,p),d=e.inArray(r.radixPoint,c);-1===f&&(p.push(r.radixPoint),f=p.length-1);for(var m=1;m<=r.digits;m++)r.digitsOptional&&(!r.enforceDigitsOnBlur||"blur"!==i.event)||p[f+m]!==n&&p[f+m]!==r.placeholder.charAt(0)?-1!==d&&c[d+m]!==n&&(p[f+m]=p[f+m]||c[d+m]):p[f+m]=i.placeholder||r.placeholder.charAt(0)}if(!0!==r.autoGroup||""===r.groupSeparator||u===r.radixPoint&&i.pos===n&&!i.dopost)p=p.join("");else{var h=p[p.length-1]===r.radixPoint&&i.c===r.radixPoint;p=t(function(e,t){var n="";if(n+="("+t.groupSeparator+"*{"+t.groupSize+"}){*}",""!==t.radixPoint){var a=e.join("").split(t.radixPoint);a[1]&&(n+=t.radixPoint+"*{"+a[1].match(/^\d*\??\d*/)[0].length+"}")}return n}(p,r),{numericInput:!0,jitMasking:!0,definitions:{"*":{validator:"[0-9?]",cardinality:1}}}).format(p.join("")),h&&(p+=r.radixPoint),p.charAt(0)===r.groupSeparator&&p.substr(1)}}if(r.isNegative&&"blur"===i.event&&(r.isNegative="0"!==p),p=s+p,p+=o,r.isNegative&&(p=r.negationSymbol.front+p,p+=r.negationSymbol.back),p=p.split(""),u!==n)if(u!==r.radixPoint&&u!==r.negationSymbol.front&&u!==r.negationSymbol.back)(l=e.inArray("?",p))>-1?p[l]=u:l=i.caret||0;else if(u===r.radixPoint||u===r.negationSymbol.front||u===r.negationSymbol.back){var g=e.inArray(u,p);-1!==g&&(l=g)}r.numericInput&&(l=p.length-l-1,p=p.reverse());var v={caret:u===n||i.pos!==n?l+(r.numericInput?-1:1):l,buffer:p,refreshFromBuffer:i.dopost||a.join("")!==p.join("")};return v.refreshFromBuffer?v:i},onBeforeWrite:function(a,i,r,o){if(a)switch(a.type){case"keydown":return o.postValidation(i,{caret:r,dopost:!0},o);case"blur":case"checkval":var s;if(function(e){e.parseMinMaxOptions===n&&(null!==e.min&&(e.min=e.min.toString().replace(new RegExp(t.escapeRegex(e.groupSeparator),"g"),""),","===e.radixPoint&&(e.min=e.min.replace(e.radixPoint,".")),e.min=isFinite(e.min)?parseFloat(e.min):NaN,isNaN(e.min)&&(e.min=Number.MIN_VALUE)),null!==e.max&&(e.max=e.max.toString().replace(new RegExp(t.escapeRegex(e.groupSeparator),"g"),""),","===e.radixPoint&&(e.max=e.max.replace(e.radixPoint,".")),e.max=isFinite(e.max)?parseFloat(e.max):NaN,isNaN(e.max)&&(e.max=Number.MAX_VALUE)),e.parseMinMaxOptions="done")}(o),null!==o.min||null!==o.max){if(s=o.onUnMask(i.join(""),n,e.extend({},o,{unmaskAsNumber:!0})),null!==o.min&&s<o.min)return o.isNegative=o.min<0,o.postValidation(o.min.toString().replace(".",o.radixPoint).split(""),{caret:r,dopost:!0,placeholder:"0"},o);if(null!==o.max&&s>o.max)return o.isNegative=o.max<0,o.postValidation(o.max.toString().replace(".",o.radixPoint).split(""),{caret:r,dopost:!0,placeholder:"0"},o)}return o.postValidation(i,{caret:r,placeholder:"0",event:"blur"},o);case"_checkval":return{caret:r}}},regex:{integerPart:function(e,n){return n?new RegExp("["+t.escapeRegex(e.negationSymbol.front)+"+]?"):new RegExp("["+t.escapeRegex(e.negationSymbol.front)+"+]?\\d+")},integerNPart:function(e){return new RegExp("[\\d"+t.escapeRegex(e.groupSeparator)+t.escapeRegex(e.placeholder.charAt(0))+"]+")}},definitions:{"~":{validator:function(e,a,i,r,o,s){var l=r?new RegExp("[0-9"+t.escapeRegex(o.groupSeparator)+"]").test(e):new RegExp("[0-9]").test(e);if(!0===l){if(!0!==o.numericInput&&a.validPositions[i]!==n&&"~"===a.validPositions[i].match.def&&!s){var c=a.buffer.join(""),u=(c=(c=c.replace(new RegExp("[-"+t.escapeRegex(o.negationSymbol.front)+"]","g"),"")).replace(new RegExp(t.escapeRegex(o.negationSymbol.back)+"$"),"")).split(o.radixPoint);u.length>1&&(u[1]=u[1].replace(/0/g,o.placeholder.charAt(0))),"0"===u[0]&&(u[0]=u[0].replace(/0/g,o.placeholder.charAt(0))),c=u[0]+o.radixPoint+u[1]||"";var p=a._buffer.join("");for(c===o.radixPoint&&(c=p);null===c.match(t.escapeRegex(p)+"$");)p=p.slice(1);l=(c=(c=c.replace(p,"")).split(""))[i]===n?{pos:i,remove:i}:{pos:i}}}else r||e!==o.radixPoint||a.validPositions[i-1]!==n||(a.buffer[i]="0",l={pos:i+1});return l},cardinality:1},"+":{validator:function(e,t,n,a,i){return i.allowMinus&&("-"===e||e===i.negationSymbol.front)},cardinality:1,placeholder:""},"-":{validator:function(e,t,n,a,i){return i.allowMinus&&e===i.negationSymbol.back},cardinality:1,placeholder:""},":":{validator:function(e,n,a,i,r){var o="["+t.escapeRegex(r.radixPoint)+"]",s=new RegExp(o).test(e);return s&&n.validPositions[a]&&n.validPositions[a].match.placeholder===r.radixPoint&&(s={caret:a+1}),s},cardinality:1,placeholder:function(e){return e.radixPoint}}},onUnMask:function(e,n,a){if(""===n&&!0===a.nullable)return n;var i=e.replace(a.prefix,"");return i=i.replace(a.suffix,""),i=i.replace(new RegExp(t.escapeRegex(a.groupSeparator),"g"),""),""!==a.placeholder.charAt(0)&&(i=i.replace(new RegExp(a.placeholder.charAt(0),"g"),"0")),a.unmaskAsNumber?(""!==a.radixPoint&&-1!==i.indexOf(a.radixPoint)&&(i=i.replace(t.escapeRegex.call(this,a.radixPoint),".")),i=i.replace(new RegExp("^"+t.escapeRegex(a.negationSymbol.front)),"-"),i=i.replace(new RegExp(t.escapeRegex(a.negationSymbol.back)+"$"),""),Number(i)):i},isComplete:function(e,n){var a=e.join("");if(e.slice().join("")!==a)return!1;var i=a.replace(n.prefix,"");return i=i.replace(n.suffix,""),i=i.replace(new RegExp(t.escapeRegex(n.groupSeparator),"g"),""),","===n.radixPoint&&(i=i.replace(t.escapeRegex(n.radixPoint),".")),isFinite(i)},onBeforeMask:function(e,a){if(a.isNegative=n,e=e.toString().charAt(e.length-1)===a.radixPoint?e.toString().substr(0,e.length-1):e.toString(),""!==a.radixPoint&&isFinite(e)){var i=e.split("."),r=""!==a.groupSeparator?parseInt(a.groupSize):0;2===i.length&&(i[0].length>r||i[1].length>r||i[0].length<=r&&i[1].length<r)&&(e=e.replace(".",a.radixPoint))}var o=e.match(/,/g),s=e.match(/\./g);if(e=s&&o?s.length>o.length?(e=e.replace(/\./g,"")).replace(",",a.radixPoint):o.length>s.length?(e=e.replace(/,/g,"")).replace(".",a.radixPoint):e.indexOf(".")<e.indexOf(",")?e.replace(/\./g,""):e.replace(/,/g,""):e.replace(new RegExp(t.escapeRegex(a.groupSeparator),"g"),""),0===a.digits&&(-1!==e.indexOf(".")?e=e.substring(0,e.indexOf(".")):-1!==e.indexOf(",")&&(e=e.substring(0,e.indexOf(",")))),""!==a.radixPoint&&isFinite(a.digits)&&-1!==e.indexOf(a.radixPoint)){var l=e.split(a.radixPoint)[1].match(new RegExp("\\d*"))[0];if(parseInt(a.digits)<l.toString().length){var c=Math.pow(10,parseInt(a.digits));e=e.replace(t.escapeRegex(a.radixPoint),"."),e=(e=Math.round(parseFloat(e)*c)/c).toString().replace(".",a.radixPoint)}}return e},canClearPosition:function(e,t,n,a,i){var r=e.validPositions[t],o=r.input!==i.radixPoint||null!==e.validPositions[t].match.fn&&!1===i.decimalProtect||r.input===i.radixPoint&&e.validPositions[t+1]&&null===e.validPositions[t+1].match.fn||isFinite(r.input)||t===n||r.input===i.groupSeparator||r.input===i.negationSymbol.front||r.input===i.negationSymbol.back;return!o||"+"!==r.match.nativeDef&&"-"!==r.match.nativeDef||(i.isNegative=!1),o},onKeyDown:function(n,a,i,r){var o=e(this);if(n.ctrlKey)switch(n.keyCode){case t.keyCode.UP:o.val(parseFloat(this.inputmask.unmaskedvalue())+parseInt(r.step)),o.trigger("setvalue");break;case t.keyCode.DOWN:o.val(parseFloat(this.inputmask.unmaskedvalue())-parseInt(r.step)),o.trigger("setvalue")}}},currency:{prefix:"$ ",groupSeparator:",",alias:"numeric",placeholder:"0",autoGroup:!0,digits:2,digitsOptional:!1,clearMaskOnLostFocus:!1},decimal:{alias:"numeric"},integer:{alias:"numeric",digits:0,radixPoint:""},percentage:{alias:"numeric",digits:2,digitsOptional:!0,radixPoint:".",placeholder:"0",autoGroup:!1,min:0,max:100,suffix:" %",allowMinus:!1}}),t})},function(e,t,n){"use strict";var a,i,r;"function"==typeof Symbol&&Symbol.iterator;!function(o){i=[n(0),n(1)],void 0!==(r="function"==typeof(a=o)?a.apply(t,i):a)&&(e.exports=r)}(function(e,t){function n(e,t){var n=(e.mask||e).replace(/#/g,"9").replace(/\)/,"9").replace(/[+()#-]/g,""),a=(t.mask||t).replace(/#/g,"9").replace(/\)/,"9").replace(/[+()#-]/g,""),i=(e.mask||e).split("#")[0],r=(t.mask||t).split("#")[0];return 0===r.indexOf(i)?-1:0===i.indexOf(r)?1:n.localeCompare(a)}var a=t.prototype.analyseMask;return t.prototype.analyseMask=function(t,n,i){function r(e,n,a){n=n||"",a=a||s,""!==n&&(a[n]={});for(var i="",o=a[n]||a,l=e.length-1;l>=0;l--)o[i=(t=e[l].mask||e[l]).substr(0,1)]=o[i]||[],o[i].unshift(t.substr(1)),e.splice(l,1);for(var c in o)o[c].length>500&&r(o[c].slice(),c,o)}function o(t){var n="",a=[];for(var r in t)e.isArray(t[r])?1===t[r].length?a.push(r+t[r]):a.push(r+i.groupmarker.start+t[r].join(i.groupmarker.end+i.alternatormarker+i.groupmarker.start)+i.groupmarker.end):a.push(r+o(t[r]));return 1===a.length?n+=a[0]:n+=i.groupmarker.start+a.join(i.groupmarker.end+i.alternatormarker+i.groupmarker.start)+i.groupmarker.end,n}var s={};return i.phoneCodes&&(i.phoneCodes&&i.phoneCodes.length>1e3&&(r((t=t.substr(1,t.length-2)).split(i.groupmarker.end+i.alternatormarker+i.groupmarker.start)),t=o(s)),t=t.replace(/9/g,"\\9")),a.call(this,t,n,i)},t.extendAliases({abstractphone:{groupmarker:{start:"<",end:">"},countrycode:"",phoneCodes:[],mask:function(e){return e.definitions={"#":t.prototype.definitions[9]},e.phoneCodes.sort(n)},keepStatic:!0,onBeforeMask:function(e,t){var n=e.replace(/^0{1,2}/,"").replace(/[\s]/g,"");return(n.indexOf(t.countrycode)>1||-1===n.indexOf(t.countrycode))&&(n="+"+t.countrycode+n),n},onUnMask:function(e,t,n){return e.replace(/[()#-]/g,"")},inputmode:"tel"}}),t})},function(e,t,n){"use strict";var a,i,r;"function"==typeof Symbol&&Symbol.iterator;!function(o){i=[n(0),n(1)],void 0!==(r="function"==typeof(a=o)?a.apply(t,i):a)&&(e.exports=r)}(function(e,t){return t.extendAliases({Regex:{mask:"r",greedy:!1,repeat:"*",regex:null,regexTokens:null,tokenizer:/\[\^?]?(?:[^\\\]]+|\\[\S\s]?)*]?|\\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9][0-9]*|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|c[A-Za-z]|[\S\s]?)|\((?:\?[:=!]?)?|(?:[?*+]|\{[0-9]+(?:,[0-9]*)?\})\??|[^.?*+^${[()|\\]+|./g,quantifierFilter:/[0-9]+[^,]/,isComplete:function(e,t){return new RegExp(t.regex,t.casing?"i":"").test(e.join(""))},definitions:{r:{validator:function(t,n,a,i,r){function o(e,t){this.matches=[],this.isGroup=e||!1,this.isQuantifier=t||!1,this.quantifier={min:1,max:1},this.repeaterPart=void 0}function s(t,n){var a=!1;n&&(p+="(",d++);for(var i=0;i<t.matches.length;i++){var o=t.matches[i];if(!0===o.isGroup)a=s(o,!0);else if(!0===o.isQuantifier){var c=e.inArray(o,t.matches),u=t.matches[c-1],f=p;if(isNaN(o.quantifier.max)){for(;o.repeaterPart&&o.repeaterPart!==p&&o.repeaterPart.length>p.length&&!(a=s(u,!0)););(a=a||s(u,!0))&&(o.repeaterPart=p),p=f+o.quantifier.max}else{for(var m=0,h=o.quantifier.max-1;m<h&&!(a=s(u,!0));m++);p=f+"{"+o.quantifier.min+","+o.quantifier.max+"}"}}else if(void 0!==o.matches)for(var g=0;g<o.length&&!(a=s(o[g],n));g++);else{var v;if("["==o.charAt(0)){v=p,v+=o;for(b=0;b<d;b++)v+=")";a=(x=new RegExp("^("+v+")$",r.casing?"i":"")).test(l)}else for(var y=0,k=o.length;y<k;y++)if("\\"!==o.charAt(y)){v=p,v=(v+=o.substr(0,y+1)).replace(/\|$/,"");for(var b=0;b<d;b++)v+=")";var x=new RegExp("^("+v+")$",r.casing?"i":"");if(a=x.test(l))break}p+=o}if(a)break}return n&&(p+=")",d--),a}var l,c,u=n.buffer.slice(),p="",f=!1,d=0;null===r.regexTokens&&function(){var e,t,n=new o,a=[];for(r.regexTokens=[];e=r.tokenizer.exec(r.regex);)switch((t=e[0]).charAt(0)){case"(":a.push(new o(!0));break;case")":c=a.pop(),a.length>0?a[a.length-1].matches.push(c):n.matches.push(c);break;case"{":case"+":case"*":var i=new o(!1,!0),s=(t=t.replace(/[{}]/g,"")).split(","),l=isNaN(s[0])?s[0]:parseInt(s[0]),u=1===s.length?l:isNaN(s[1])?s[1]:parseInt(s[1]);if(i.quantifier={min:l,max:u},a.length>0){var p=a[a.length-1].matches;(e=p.pop()).isGroup||((c=new o(!0)).matches.push(e),e=c),p.push(e),p.push(i)}else(e=n.matches.pop()).isGroup||((c=new o(!0)).matches.push(e),e=c),n.matches.push(e),n.matches.push(i);break;default:a.length>0?a[a.length-1].matches.push(t):n.matches.push(t)}n.matches.length>0&&r.regexTokens.push(n)}(),u.splice(a,0,t),l=u.join("");for(var m=0;m<r.regexTokens.length;m++){var h=r.regexTokens[m];if(f=s(h,h.isGroup))break}return f},cardinality:1}}}}),t})},function(e,t,n){"use strict";var a,i,r,o="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e};!function(o){i=[n(2),n(1)],void 0!==(r="function"==typeof(a=o)?a.apply(t,i):a)&&(e.exports=r)}(function(e,t){return void 0===e.fn.inputmask&&(e.fn.inputmask=function(n,a){var i,r=this[0];if(void 0===a&&(a={}),"string"==typeof n)switch(n){case"unmaskedvalue":return r&&r.inputmask?r.inputmask.unmaskedvalue():e(r).val();case"remove":return this.each(function(){this.inputmask&&this.inputmask.remove()});case"getemptymask":return r&&r.inputmask?r.inputmask.getemptymask():"";case"hasMaskedValue":return!(!r||!r.inputmask)&&r.inputmask.hasMaskedValue();case"isComplete":return!r||!r.inputmask||r.inputmask.isComplete();case"getmetadata":return r&&r.inputmask?r.inputmask.getmetadata():void 0;case"setvalue":e(r).val(a),r&&void 0===r.inputmask&&e(r).triggerHandler("setvalue");break;case"option":if("string"!=typeof a)return this.each(function(){if(void 0!==this.inputmask)return this.inputmask.option(a)});if(r&&void 0!==r.inputmask)return r.inputmask.option(a);break;default:return a.alias=n,i=new t(a),this.each(function(){i.mask(this)})}else{if("object"==(void 0===n?"undefined":o(n)))return i=new t(n),void 0===n.mask&&void 0===n.alias?this.each(function(){if(void 0!==this.inputmask)return this.inputmask.option(n);i.mask(this)}):this.each(function(){i.mask(this)});if(void 0===n)return this.each(function(){(i=new t(a)).mask(this)})}}),e.fn.inputmask})}]);
/*!
* phone-codes/phone.min.js
* https://github.com/RobinHerbots/Inputmask
* Copyright (c) 2010 - 2017 Robin Herbots
* Licensed under the MIT license (http://www.opensource.org/licenses/mit-license.php)
* Version: 3.3.11
*/

!function(c){"function"==typeof define&&define.amd?define(["../inputmask"],c):"object"==typeof exports?module.exports=c(require("../inputmask")):c(window.Inputmask)}(function(c){return c.extendAliases({phone:{alias:"abstractphone",phoneCodes:[{mask:"+247-####",cc:"AC",cd:"Ascension",desc_en:"",name_ru:"Остров Вознесения",desc_ru:""},{mask:"+376-###-###",cc:"AD",cd:"Andorra",desc_en:"",name_ru:"Андорра",desc_ru:""},{mask:"+971-5#-###-####",cc:"AE",cd:"United Arab Emirates",desc_en:"mobile",name_ru:"Объединенные Арабские Эмираты",desc_ru:"мобильные"},{mask:"+971-#-###-####",cc:"AE",cd:"United Arab Emirates",desc_en:"",name_ru:"Объединенные Арабские Эмираты",desc_ru:""},{mask:"+93-##-###-####",cc:"AF",cd:"Afghanistan",desc_en:"",name_ru:"Афганистан",desc_ru:""},{mask:"+1(268)###-####",cc:"AG",cd:"Antigua & Barbuda",desc_en:"",name_ru:"Антигуа и Барбуда",desc_ru:""},{mask:"+1(264)###-####",cc:"AI",cd:"Anguilla",desc_en:"",name_ru:"Ангилья",desc_ru:""},{mask:"+355(###)###-###",cc:"AL",cd:"Albania",desc_en:"",name_ru:"Албания",desc_ru:""},{mask:"+374-##-###-###",cc:"AM",cd:"Armenia",desc_en:"",name_ru:"Армения",desc_ru:""},{mask:"+599-###-####",cc:"AN",cd:"Caribbean Netherlands",desc_en:"",name_ru:"Карибские Нидерланды",desc_ru:""},{mask:"+599-###-####",cc:"AN",cd:"Netherlands Antilles",desc_en:"",name_ru:"Нидерландские Антильские острова",desc_ru:""},{mask:"+599-9###-####",cc:"AN",cd:"Netherlands Antilles",desc_en:"Curacao",name_ru:"Нидерландские Антильские острова",desc_ru:"Кюрасао"},{mask:"+244(###)###-###",cc:"AO",cd:"Angola",desc_en:"",name_ru:"Ангола",desc_ru:""},{mask:"+672-1##-###",cc:"AQ",cd:"Australian bases in Antarctica",desc_en:"",name_ru:"Австралийская антарктическая база",desc_ru:""},{mask:"+54(###)###-####",cc:"AR",cd:"Argentina",desc_en:"",name_ru:"Аргентина",desc_ru:""},{mask:"+1(684)###-####",cc:"AS",cd:"American Samoa",desc_en:"",name_ru:"Американское Самоа",desc_ru:""},{mask:"+43(###)###-####",cc:"AT",cd:"Austria",desc_en:"",name_ru:"Австрия",desc_ru:""},{mask:"+61-#-####-####",cc:"AU",cd:"Australia",desc_en:"",name_ru:"Австралия",desc_ru:""},{mask:"+297-###-####",cc:"AW",cd:"Aruba",desc_en:"",name_ru:"Аруба",desc_ru:""},{mask:"+994-##-###-##-##",cc:"AZ",cd:"Azerbaijan",desc_en:"",name_ru:"Азербайджан",desc_ru:""},{mask:"+387-##-#####",cc:"BA",cd:"Bosnia and Herzegovina",desc_en:"",name_ru:"Босния и Герцеговина",desc_ru:""},{mask:"+387-##-####",cc:"BA",cd:"Bosnia and Herzegovina",desc_en:"",name_ru:"Босния и Герцеговина",desc_ru:""},{mask:"+1(246)###-####",cc:"BB",cd:"Barbados",desc_en:"",name_ru:"Барбадос",desc_ru:""},{mask:"+880-##-###-###",cc:"BD",cd:"Bangladesh",desc_en:"",name_ru:"Бангладеш",desc_ru:""},{mask:"+32(###)###-###",cc:"BE",cd:"Belgium",desc_en:"",name_ru:"Бельгия",desc_ru:""},{mask:"+226-##-##-####",cc:"BF",cd:"Burkina Faso",desc_en:"",name_ru:"Буркина Фасо",desc_ru:""},{mask:"+359(###)###-###",cc:"BG",cd:"Bulgaria",desc_en:"",name_ru:"Болгария",desc_ru:""},{mask:"+973-####-####",cc:"BH",cd:"Bahrain",desc_en:"",name_ru:"Бахрейн",desc_ru:""},{mask:"+257-##-##-####",cc:"BI",cd:"Burundi",desc_en:"",name_ru:"Бурунди",desc_ru:""},{mask:"+229-##-##-####",cc:"BJ",cd:"Benin",desc_en:"",name_ru:"Бенин",desc_ru:""},{mask:"+1(441)###-####",cc:"BM",cd:"Bermuda",desc_en:"",name_ru:"Бермудские острова",desc_ru:""},{mask:"+673-###-####",cc:"BN",cd:"Brunei Darussalam",desc_en:"",name_ru:"Бруней-Даруссалам",desc_ru:""},{mask:"+591-#-###-####",cc:"BO",cd:"Bolivia",desc_en:"",name_ru:"Боливия",desc_ru:""},{mask:"+55-##-####-####",cc:"BR",cd:"Brazil",desc_en:"",name_ru:"Бразилия",desc_ru:""},{mask:"+55-##-#####-####",cc:"BR",cd:"Brazil",desc_en:"",name_ru:"Бразилия",desc_ru:""},{mask:"+1(242)###-####",cc:"BS",cd:"Bahamas",desc_en:"",name_ru:"Багамские Острова",desc_ru:""},{mask:"+975-17-###-###",cc:"BT",cd:"Bhutan",desc_en:"",name_ru:"Бутан",desc_ru:""},{mask:"+975-#-###-###",cc:"BT",cd:"Bhutan",desc_en:"",name_ru:"Бутан",desc_ru:""},{mask:"+267-##-###-###",cc:"BW",cd:"Botswana",desc_en:"",name_ru:"Ботсвана",desc_ru:""},{mask:"+375(##)###-##-##",cc:"BY",cd:"Belarus",desc_en:"",name_ru:"Беларусь (Белоруссия)",desc_ru:""},{mask:"+501-###-####",cc:"BZ",cd:"Belize",desc_en:"",name_ru:"Белиз",desc_ru:""},{mask:"+243(###)###-###",cc:"CD",cd:"Dem. Rep. Congo",desc_en:"",name_ru:"Дем. Респ. Конго (Киншаса)",desc_ru:""},{mask:"+236-##-##-####",cc:"CF",cd:"Central African Republic",desc_en:"",name_ru:"Центральноафриканская Республика",desc_ru:""},{mask:"+242-##-###-####",cc:"CG",cd:"Congo (Brazzaville)",desc_en:"",name_ru:"Конго (Браззавиль)",desc_ru:""},{mask:"+41-##-###-####",cc:"CH",cd:"Switzerland",desc_en:"",name_ru:"Швейцария",desc_ru:""},{mask:"+225-##-###-###",cc:"CI",cd:"Cote d’Ivoire (Ivory Coast)",desc_en:"",name_ru:"Кот-д’Ивуар",desc_ru:""},{mask:"+682-##-###",cc:"CK",cd:"Cook Islands",desc_en:"",name_ru:"Острова Кука",desc_ru:""},{mask:"+56-#-####-####",cc:"CL",cd:"Chile",desc_en:"",name_ru:"Чили",desc_ru:""},{mask:"+237-####-####",cc:"CM",cd:"Cameroon",desc_en:"",name_ru:"Камерун",desc_ru:""},{mask:"+86(###)####-####",cc:"CN",cd:"China (PRC)",desc_en:"",name_ru:"Китайская Н.Р.",desc_ru:""},{mask:"+86(###)####-###",cc:"CN",cd:"China (PRC)",desc_en:"",name_ru:"Китайская Н.Р.",desc_ru:""},{mask:"+86-##-#####-#####",cc:"CN",cd:"China (PRC)",desc_en:"",name_ru:"Китайская Н.Р.",desc_ru:""},{mask:"+57(###)###-####",cc:"CO",cd:"Colombia",desc_en:"",name_ru:"Колумбия",desc_ru:""},{mask:"+506-####-####",cc:"CR",cd:"Costa Rica",desc_en:"",name_ru:"Коста-Рика",desc_ru:""},{mask:"+53-#-###-####",cc:"CU",cd:"Cuba",desc_en:"",name_ru:"Куба",desc_ru:""},{mask:"+238(###)##-##",cc:"CV",cd:"Cape Verde",desc_en:"",name_ru:"Кабо-Верде",desc_ru:""},{mask:"+599-###-####",cc:"CW",cd:"Curacao",desc_en:"",name_ru:"Кюрасао",desc_ru:""},{mask:"+357-##-###-###",cc:"CY",cd:"Cyprus",desc_en:"",name_ru:"Кипр",desc_ru:""},{mask:"+420(###)###-###",cc:"CZ",cd:"Czech Republic",desc_en:"",name_ru:"Чехия",desc_ru:""},{mask:"+49(####)###-####",cc:"DE",cd:"Germany",desc_en:"",name_ru:"Германия",desc_ru:""},{mask:"+49(###)###-####",cc:"DE",cd:"Germany",desc_en:"",name_ru:"Германия",desc_ru:""},{mask:"+49(###)##-####",cc:"DE",cd:"Germany",desc_en:"",name_ru:"Германия",desc_ru:""},{mask:"+49(###)##-###",cc:"DE",cd:"Germany",desc_en:"",name_ru:"Германия",desc_ru:""},{mask:"+49(###)##-##",cc:"DE",cd:"Germany",desc_en:"",name_ru:"Германия",desc_ru:""},{mask:"+49-###-###",cc:"DE",cd:"Germany",desc_en:"",name_ru:"Германия",desc_ru:""},{mask:"+253-##-##-##-##",cc:"DJ",cd:"Djibouti",desc_en:"",name_ru:"Джибути",desc_ru:""},{mask:"+45-##-##-##-##",cc:"DK",cd:"Denmark",desc_en:"",name_ru:"Дания",desc_ru:""},{mask:"+1(767)###-####",cc:"DM",cd:"Dominica",desc_en:"",name_ru:"Доминика",desc_ru:""},{mask:"+1(809)###-####",cc:"DO",cd:"Dominican Republic",desc_en:"",name_ru:"Доминиканская Республика",desc_ru:""},{mask:"+1(829)###-####",cc:"DO",cd:"Dominican Republic",desc_en:"",name_ru:"Доминиканская Республика",desc_ru:""},{mask:"+1(849)###-####",cc:"DO",cd:"Dominican Republic",desc_en:"",name_ru:"Доминиканская Республика",desc_ru:""},{mask:"+213-##-###-####",cc:"DZ",cd:"Algeria",desc_en:"",name_ru:"Алжир",desc_ru:""},{mask:"+593-##-###-####",cc:"EC",cd:"Ecuador ",desc_en:"mobile",name_ru:"Эквадор ",desc_ru:"мобильные"},{mask:"+593-#-###-####",cc:"EC",cd:"Ecuador",desc_en:"",name_ru:"Эквадор",desc_ru:""},{mask:"+372-####-####",cc:"EE",cd:"Estonia ",desc_en:"mobile",name_ru:"Эстония ",desc_ru:"мобильные"},{mask:"+372-###-####",cc:"EE",cd:"Estonia",desc_en:"",name_ru:"Эстония",desc_ru:""},{mask:"+20(###)###-####",cc:"EG",cd:"Egypt",desc_en:"",name_ru:"Египет",desc_ru:""},{mask:"+291-#-###-###",cc:"ER",cd:"Eritrea",desc_en:"",name_ru:"Эритрея",desc_ru:""},{mask:"+34(###)###-###",cc:"ES",cd:"Spain",desc_en:"",name_ru:"Испания",desc_ru:""},{mask:"+251-##-###-####",cc:"ET",cd:"Ethiopia",desc_en:"",name_ru:"Эфиопия",desc_ru:""},{mask:"+358(###)###-##-##",cc:"FI",cd:"Finland",desc_en:"",name_ru:"Финляндия",desc_ru:""},{mask:"+679-##-#####",cc:"FJ",cd:"Fiji",desc_en:"",name_ru:"Фиджи",desc_ru:""},{mask:"+500-#####",cc:"FK",cd:"Falkland Islands",desc_en:"",name_ru:"Фолклендские острова",desc_ru:""},{mask:"+691-###-####",cc:"FM",cd:"F.S. Micronesia",desc_en:"",name_ru:"Ф.Ш. Микронезии",desc_ru:""},{mask:"+298-###-###",cc:"FO",cd:"Faroe Islands",desc_en:"",name_ru:"Фарерские острова",desc_ru:""},{mask:"+262-#####-####",cc:"FR",cd:"Mayotte",desc_en:"",name_ru:"Майотта",desc_ru:""},{mask:"+33(###)###-###",cc:"FR",cd:"France",desc_en:"",name_ru:"Франция",desc_ru:""},{mask:"+508-##-####",cc:"FR",cd:"St Pierre & Miquelon",desc_en:"",name_ru:"Сен-Пьер и Микелон",desc_ru:""},{mask:"+590(###)###-###",cc:"FR",cd:"Guadeloupe",desc_en:"",name_ru:"Гваделупа",desc_ru:""},{mask:"+241-#-##-##-##",cc:"GA",cd:"Gabon",desc_en:"",name_ru:"Габон",desc_ru:""},{mask:"+1(473)###-####",cc:"GD",cd:"Grenada",desc_en:"",name_ru:"Гренада",desc_ru:""},{mask:"+995(###)###-###",cc:"GE",cd:"Rep. of Georgia",desc_en:"",name_ru:"Грузия",desc_ru:""},{mask:"+594-#####-####",cc:"GF",cd:"Guiana (French)",desc_en:"",name_ru:"Фр. Гвиана",desc_ru:""},{mask:"+233(###)###-###",cc:"GH",cd:"Ghana",desc_en:"",name_ru:"Гана",desc_ru:""},{mask:"+350-###-#####",cc:"GI",cd:"Gibraltar",desc_en:"",name_ru:"Гибралтар",desc_ru:""},{mask:"+299-##-##-##",cc:"GL",cd:"Greenland",desc_en:"",name_ru:"Гренландия",desc_ru:""},{mask:"+220(###)##-##",cc:"GM",cd:"Gambia",desc_en:"",name_ru:"Гамбия",desc_ru:""},{mask:"+224-##-###-###",cc:"GN",cd:"Guinea",desc_en:"",name_ru:"Гвинея",desc_ru:""},{mask:"+240-##-###-####",cc:"GQ",cd:"Equatorial Guinea",desc_en:"",name_ru:"Экваториальная Гвинея",desc_ru:""},{mask:"+30(###)###-####",cc:"GR",cd:"Greece",desc_en:"",name_ru:"Греция",desc_ru:""},{mask:"+502-#-###-####",cc:"GT",cd:"Guatemala",desc_en:"",name_ru:"Гватемала",desc_ru:""},{mask:"+1(671)###-####",cc:"GU",cd:"Guam",desc_en:"",name_ru:"Гуам",desc_ru:""},{mask:"+245-#-######",cc:"GW",cd:"Guinea-Bissau",desc_en:"",name_ru:"Гвинея-Бисау",desc_ru:""},{mask:"+592-###-####",cc:"GY",cd:"Guyana",desc_en:"",name_ru:"Гайана",desc_ru:""},{mask:"+852-####-####",cc:"HK",cd:"Hong Kong",desc_en:"",name_ru:"Гонконг",desc_ru:""},{mask:"+504-####-####",cc:"HN",cd:"Honduras",desc_en:"",name_ru:"Гондурас",desc_ru:""},{mask:"+385-(##)-###-###",cc:"HR",cd:"Croatia",desc_en:"",name_ru:"Хорватия",desc_ru:""},{mask:"+385-(##)-###-####",cc:"HR",cd:"Croatia",desc_en:"",name_ru:"Хорватия",desc_ru:""},{mask:"+385-1-####-###",cc:"HR",cd:"Croatia",desc_en:"",name_ru:"Хорватия",desc_ru:""},{mask:"+509-##-##-####",cc:"HT",cd:"Haiti",desc_en:"",name_ru:"Гаити",desc_ru:""},{mask:"+36(###)###-###",cc:"HU",cd:"Hungary",desc_en:"",name_ru:"Венгрия",desc_ru:""},{mask:"+62(8##)###-####",cc:"ID",cd:"Indonesia ",desc_en:"mobile",name_ru:"Индонезия ",desc_ru:"мобильные"},{mask:"+62-##-###-##",cc:"ID",cd:"Indonesia",desc_en:"",name_ru:"Индонезия",desc_ru:""},{mask:"+62-##-###-###",cc:"ID",cd:"Indonesia",desc_en:"",name_ru:"Индонезия",desc_ru:""},{mask:"+62-##-###-####",cc:"ID",cd:"Indonesia",desc_en:"",name_ru:"Индонезия",desc_ru:""},{mask:"+62(8##)###-###",cc:"ID",cd:"Indonesia ",desc_en:"mobile",name_ru:"Индонезия ",desc_ru:"мобильные"},{mask:"+62(8##)###-##-###",cc:"ID",cd:"Indonesia ",desc_en:"mobile",name_ru:"Индонезия ",desc_ru:"мобильные"},{mask:"+353(###)###-###",cc:"IE",cd:"Ireland",desc_en:"",name_ru:"Ирландия",desc_ru:""},{mask:"+972-5#-###-####",cc:"IL",cd:"Israel ",desc_en:"mobile",name_ru:"Израиль ",desc_ru:"мобильные"},{mask:"+972-#-###-####",cc:"IL",cd:"Israel",desc_en:"",name_ru:"Израиль",desc_ru:""},{mask:"+91(####)###-###",cc:"IN",cd:"India",desc_en:"",name_ru:"Индия",desc_ru:""},{mask:"+246-###-####",cc:"IO",cd:"Diego Garcia",desc_en:"",name_ru:"Диего-Гарсия",desc_ru:""},{mask:"+964(###)###-####",cc:"IQ",cd:"Iraq",desc_en:"",name_ru:"Ирак",desc_ru:""},{mask:"+98(###)###-####",cc:"IR",cd:"Iran",desc_en:"",name_ru:"Иран",desc_ru:""},{mask:"+354-###-####",cc:"IS",cd:"Iceland",desc_en:"",name_ru:"Исландия",desc_ru:""},{mask:"+39(###)####-###",cc:"IT",cd:"Italy",desc_en:"",name_ru:"Италия",desc_ru:""},{mask:"+1(876)###-####",cc:"JM",cd:"Jamaica",desc_en:"",name_ru:"Ямайка",desc_ru:""},{mask:"+962-#-####-####",cc:"JO",cd:"Jordan",desc_en:"",name_ru:"Иордания",desc_ru:""},{mask:"+81-##-####-####",cc:"JP",cd:"Japan ",desc_en:"mobile",name_ru:"Япония ",desc_ru:"мобильные"},{mask:"+81(###)###-###",cc:"JP",cd:"Japan",desc_en:"",name_ru:"Япония",desc_ru:""},{mask:"+254-###-######",cc:"KE",cd:"Kenya",desc_en:"",name_ru:"Кения",desc_ru:""},{mask:"+996(###)###-###",cc:"KG",cd:"Kyrgyzstan",desc_en:"",name_ru:"Киргизия",desc_ru:""},{mask:"+855-##-###-###",cc:"KH",cd:"Cambodia",desc_en:"",name_ru:"Камбоджа",desc_ru:""},{mask:"+686-##-###",cc:"KI",cd:"Kiribati",desc_en:"",name_ru:"Кирибати",desc_ru:""},{mask:"+269-##-#####",cc:"KM",cd:"Comoros",desc_en:"",name_ru:"Коморы",desc_ru:""},{mask:"+1(869)###-####",cc:"KN",cd:"Saint Kitts & Nevis",desc_en:"",name_ru:"Сент-Китс и Невис",desc_ru:""},{mask:"+850-191-###-####",cc:"KP",cd:"DPR Korea (North) ",desc_en:"mobile",name_ru:"Корейская НДР ",desc_ru:"мобильные"},{mask:"+850-##-###-###",cc:"KP",cd:"DPR Korea (North)",desc_en:"",name_ru:"Корейская НДР",desc_ru:""},{mask:"+850-###-####-###",cc:"KP",cd:"DPR Korea (North)",desc_en:"",name_ru:"Корейская НДР",desc_ru:""},{mask:"+850-###-###",cc:"KP",cd:"DPR Korea (North)",desc_en:"",name_ru:"Корейская НДР",desc_ru:""},{mask:"+850-####-####",cc:"KP",cd:"DPR Korea (North)",desc_en:"",name_ru:"Корейская НДР",desc_ru:""},{mask:"+850-####-#############",cc:"KP",cd:"DPR Korea (North)",desc_en:"",name_ru:"Корейская НДР",desc_ru:""},{mask:"+82-##-###-####",cc:"KR",cd:"Korea (South)",desc_en:"",name_ru:"Респ. Корея",desc_ru:""},{mask:"+965-####-####",cc:"KW",cd:"Kuwait",desc_en:"",name_ru:"Кувейт",desc_ru:""},{mask:"+1(345)###-####",cc:"KY",cd:"Cayman Islands",desc_en:"",name_ru:"Каймановы острова",desc_ru:""},{mask:"+7(6##)###-##-##",cc:"KZ",cd:"Kazakhstan",desc_en:"",name_ru:"Казахстан",desc_ru:""},{mask:"+7(7##)###-##-##",cc:"KZ",cd:"Kazakhstan",desc_en:"",name_ru:"Казахстан",desc_ru:""},{mask:"+856(20##)###-###",cc:"LA",cd:"Laos ",desc_en:"mobile",name_ru:"Лаос ",desc_ru:"мобильные"},{mask:"+856-##-###-###",cc:"LA",cd:"Laos",desc_en:"",name_ru:"Лаос",desc_ru:""},{mask:"+961-##-###-###",cc:"LB",cd:"Lebanon ",desc_en:"mobile",name_ru:"Ливан ",desc_ru:"мобильные"},{mask:"+961-#-###-###",cc:"LB",cd:"Lebanon",desc_en:"",name_ru:"Ливан",desc_ru:""},{mask:"+1(758)###-####",cc:"LC",cd:"Saint Lucia",desc_en:"",name_ru:"Сент-Люсия",desc_ru:""},{mask:"+423(###)###-####",cc:"LI",cd:"Liechtenstein",desc_en:"",name_ru:"Лихтенштейн",desc_ru:""},{mask:"+94-##-###-####",cc:"LK",cd:"Sri Lanka",desc_en:"",name_ru:"Шри-Ланка",desc_ru:""},{mask:"+231-##-###-###",cc:"LR",cd:"Liberia",desc_en:"",name_ru:"Либерия",desc_ru:""},{mask:"+266-#-###-####",cc:"LS",cd:"Lesotho",desc_en:"",name_ru:"Лесото",desc_ru:""},{mask:"+370(###)##-###",cc:"LT",cd:"Lithuania",desc_en:"",name_ru:"Литва",desc_ru:""},{mask:"+352-###-###",cc:"LU",cd:"Luxembourg",desc_en:"",name_ru:"Люксембург",desc_ru:""},{mask:"+352-####-###",cc:"LU",cd:"Luxembourg",desc_en:"",name_ru:"Люксембург",desc_ru:""},{mask:"+352-#####-###",cc:"LU",cd:"Luxembourg",desc_en:"",name_ru:"Люксембург",desc_ru:""},{mask:"+352-######-###",cc:"LU",cd:"Luxembourg",desc_en:"",name_ru:"Люксембург",desc_ru:""},{mask:"+371-##-###-###",cc:"LV",cd:"Latvia",desc_en:"",name_ru:"Латвия",desc_ru:""},{mask:"+218-##-###-###",cc:"LY",cd:"Libya",desc_en:"",name_ru:"Ливия",desc_ru:""},{mask:"+218-21-###-####",cc:"LY",cd:"Libya",desc_en:"Tripoli",name_ru:"Ливия",desc_ru:"Триполи"},{mask:"+212-##-####-###",cc:"MA",cd:"Morocco",desc_en:"",name_ru:"Марокко",desc_ru:""},{mask:"+377(###)###-###",cc:"MC",cd:"Monaco",desc_en:"",name_ru:"Монако",desc_ru:""},{mask:"+377-##-###-###",cc:"MC",cd:"Monaco",desc_en:"",name_ru:"Монако",desc_ru:""},{mask:"+373-####-####",cc:"MD",cd:"Moldova",desc_en:"",name_ru:"Молдова",desc_ru:""},{mask:"+382-##-###-###",cc:"ME",cd:"Montenegro",desc_en:"",name_ru:"Черногория",desc_ru:""},{mask:"+261-##-##-#####",cc:"MG",cd:"Madagascar",desc_en:"",name_ru:"Мадагаскар",desc_ru:""},{mask:"+692-###-####",cc:"MH",cd:"Marshall Islands",desc_en:"",name_ru:"Маршалловы Острова",desc_ru:""},{mask:"+389-##-###-###",cc:"MK",cd:"Republic of Macedonia",desc_en:"",name_ru:"Респ. Македония",desc_ru:""},{mask:"+223-##-##-####",cc:"ML",cd:"Mali",desc_en:"",name_ru:"Мали",desc_ru:""},{mask:"+95-##-###-###",cc:"MM",cd:"Burma (Myanmar)",desc_en:"",name_ru:"Бирма (Мьянма)",desc_ru:""},{mask:"+95-#-###-###",cc:"MM",cd:"Burma (Myanmar)",desc_en:"",name_ru:"Бирма (Мьянма)",desc_ru:""},{mask:"+95-###-###",cc:"MM",cd:"Burma (Myanmar)",desc_en:"",name_ru:"Бирма (Мьянма)",desc_ru:""},{mask:"+976-##-##-####",cc:"MN",cd:"Mongolia",desc_en:"",name_ru:"Монголия",desc_ru:""},{mask:"+853-####-####",cc:"MO",cd:"Macau",desc_en:"",name_ru:"Макао",desc_ru:""},{mask:"+1(670)###-####",cc:"MP",cd:"Northern Mariana Islands",desc_en:"",name_ru:"Северные Марианские острова Сайпан",desc_ru:""},{mask:"+596(###)##-##-##",cc:"MQ",cd:"Martinique",desc_en:"",name_ru:"Мартиника",desc_ru:""},{mask:"+222-##-##-####",cc:"MR",cd:"Mauritania",desc_en:"",name_ru:"Мавритания",desc_ru:""},{mask:"+1(664)###-####",cc:"MS",cd:"Montserrat",desc_en:"",name_ru:"Монтсеррат",desc_ru:""},{mask:"+356-####-####",cc:"MT",cd:"Malta",desc_en:"",name_ru:"Мальта",desc_ru:""},{mask:"+230-###-####",cc:"MU",cd:"Mauritius",desc_en:"",name_ru:"Маврикий",desc_ru:""},{mask:"+960-###-####",cc:"MV",cd:"Maldives",desc_en:"",name_ru:"Мальдивские острова",desc_ru:""},{mask:"+265-1-###-###",cc:"MW",cd:"Malawi",desc_en:"Telecom Ltd",name_ru:"Малави",desc_ru:"Telecom Ltd"},{mask:"+265-#-####-####",cc:"MW",cd:"Malawi",desc_en:"",name_ru:"Малави",desc_ru:""},{mask:"+52(###)###-####",cc:"MX",cd:"Mexico",desc_en:"",name_ru:"Мексика",desc_ru:""},{mask:"+52-##-##-####",cc:"MX",cd:"Mexico",desc_en:"",name_ru:"Мексика",desc_ru:""},{mask:"+60-##-###-####",cc:"MY",cd:"Malaysia ",desc_en:"mobile",name_ru:"Малайзия ",desc_ru:"мобильные"},{mask:"+60-11-####-####",cc:"MY",cd:"Malaysia ",desc_en:"mobile",name_ru:"Малайзия ",desc_ru:"мобильные"},{mask:"+60(###)###-###",cc:"MY",cd:"Malaysia",desc_en:"",name_ru:"Малайзия",desc_ru:""},{mask:"+60-##-###-###",cc:"MY",cd:"Malaysia",desc_en:"",name_ru:"Малайзия",desc_ru:""},{mask:"+60-#-###-###",cc:"MY",cd:"Malaysia",desc_en:"",name_ru:"Малайзия",desc_ru:""},{mask:"+258-##-###-###",cc:"MZ",cd:"Mozambique",desc_en:"",name_ru:"Мозамбик",desc_ru:""},{mask:"+264-##-###-####",cc:"NA",cd:"Namibia",desc_en:"",name_ru:"Намибия",desc_ru:""},{mask:"+687-##-####",cc:"NC",cd:"New Caledonia",desc_en:"",name_ru:"Новая Каледония",desc_ru:""},{mask:"+227-##-##-####",cc:"NE",cd:"Niger",desc_en:"",name_ru:"Нигер",desc_ru:""},{mask:"+672-3##-###",cc:"NF",cd:"Norfolk Island",desc_en:"",name_ru:"Норфолк (остров)",desc_ru:""},{mask:"+234(###)###-####",cc:"NG",cd:"Nigeria",desc_en:"",name_ru:"Нигерия",desc_ru:""},{mask:"+234-##-###-###",cc:"NG",cd:"Nigeria",desc_en:"",name_ru:"Нигерия",desc_ru:""},{mask:"+234-##-###-##",cc:"NG",cd:"Nigeria",desc_en:"",name_ru:"Нигерия",desc_ru:""},{mask:"+234(###)###-####",cc:"NG",cd:"Nigeria ",desc_en:"mobile",name_ru:"Нигерия ",desc_ru:"мобильные"},{mask:"+505-####-####",cc:"NI",cd:"Nicaragua",desc_en:"",name_ru:"Никарагуа",desc_ru:""},{mask:"+31-##-###-####",cc:"NL",cd:"Netherlands",desc_en:"",name_ru:"Нидерланды",desc_ru:""},{mask:"+47(###)##-###",cc:"NO",cd:"Norway",desc_en:"",name_ru:"Норвегия",desc_ru:""},{mask:"+977-##-###-###",cc:"NP",cd:"Nepal",desc_en:"",name_ru:"Непал",desc_ru:""},{mask:"+674-###-####",cc:"NR",cd:"Nauru",desc_en:"",name_ru:"Науру",desc_ru:""},{mask:"+683-####",cc:"NU",cd:"Niue",desc_en:"",name_ru:"Ниуэ",desc_ru:""},{mask:"+64(###)###-###",cc:"NZ",cd:"New Zealand",desc_en:"",name_ru:"Новая Зеландия",desc_ru:""},{mask:"+64-##-###-###",cc:"NZ",cd:"New Zealand",desc_en:"",name_ru:"Новая Зеландия",desc_ru:""},{mask:"+64(###)###-####",cc:"NZ",cd:"New Zealand",desc_en:"",name_ru:"Новая Зеландия",desc_ru:""},{mask:"+968-##-###-###",cc:"OM",cd:"Oman",desc_en:"",name_ru:"Оман",desc_ru:""},{mask:"+507-###-####",cc:"PA",cd:"Panama",desc_en:"",name_ru:"Панама",desc_ru:""},{mask:"+51(###)###-###",cc:"PE",cd:"Peru",desc_en:"",name_ru:"Перу",desc_ru:""},{mask:"+689-##-##-##",cc:"PF",cd:"French Polynesia",desc_en:"",name_ru:"Французская Полинезия (Таити)",desc_ru:""},{mask:"+675(###)##-###",cc:"PG",cd:"Papua New Guinea",desc_en:"",name_ru:"Папуа-Новая Гвинея",desc_ru:""},{mask:"+63(###)###-####",cc:"PH",cd:"Philippines",desc_en:"",name_ru:"Филиппины",desc_ru:""},{mask:"+92(###)###-####",cc:"PK",cd:"Pakistan",desc_en:"",name_ru:"Пакистан",desc_ru:""},{mask:"+48(###)###-###",cc:"PL",cd:"Poland",desc_en:"",name_ru:"Польша",desc_ru:""},{mask:"+970-##-###-####",cc:"PS",cd:"Palestine",desc_en:"",name_ru:"Палестина",desc_ru:""},{mask:"+351-##-###-####",cc:"PT",cd:"Portugal",desc_en:"",name_ru:"Португалия",desc_ru:""},{mask:"+680-###-####",cc:"PW",cd:"Palau",desc_en:"",name_ru:"Палау",desc_ru:""},{mask:"+595(###)###-###",cc:"PY",cd:"Paraguay",desc_en:"",name_ru:"Парагвай",desc_ru:""},{mask:"+974-####-####",cc:"QA",cd:"Qatar",desc_en:"",name_ru:"Катар",desc_ru:""},{mask:"+262-#####-####",cc:"RE",cd:"Reunion",desc_en:"",name_ru:"Реюньон",desc_ru:""},{mask:"+40-##-###-####",cc:"RO",cd:"Romania",desc_en:"",name_ru:"Румыния",desc_ru:""},{mask:"+381-##-###-####",cc:"RS",cd:"Serbia",desc_en:"",name_ru:"Сербия",desc_ru:""},{mask:"+7(###)###-##-##",cc:"RU",cd:"Russia",desc_en:"",name_ru:"Россия",desc_ru:""},{mask:"+250(###)###-###",cc:"RW",cd:"Rwanda",desc_en:"",name_ru:"Руанда",desc_ru:""},{mask:"+966-5-####-####",cc:"SA",cd:"Saudi Arabia ",desc_en:"mobile",name_ru:"Саудовская Аравия ",desc_ru:"мобильные"},{mask:"+966-#-###-####",cc:"SA",cd:"Saudi Arabia",desc_en:"",name_ru:"Саудовская Аравия",desc_ru:""},{mask:"+677-###-####",cc:"SB",cd:"Solomon Islands ",desc_en:"mobile",name_ru:"Соломоновы Острова ",desc_ru:"мобильные"},{mask:"+677-#####",cc:"SB",cd:"Solomon Islands",desc_en:"",name_ru:"Соломоновы Острова",desc_ru:""},{mask:"+248-#-###-###",cc:"SC",cd:"Seychelles",desc_en:"",name_ru:"Сейшелы",desc_ru:""},{mask:"+249-##-###-####",cc:"SD",cd:"Sudan",desc_en:"",name_ru:"Судан",desc_ru:""},{mask:"+46-##-###-####",cc:"SE",cd:"Sweden",desc_en:"",name_ru:"Швеция",desc_ru:""},{mask:"+65-####-####",cc:"SG",cd:"Singapore",desc_en:"",name_ru:"Сингапур",desc_ru:""},{mask:"+290-####",cc:"SH",cd:"Saint Helena",desc_en:"",name_ru:"Остров Святой Елены",desc_ru:""},{mask:"+290-####",cc:"SH",cd:"Tristan da Cunha",desc_en:"",name_ru:"Тристан-да-Кунья",desc_ru:""},{mask:"+386-##-###-###",cc:"SI",cd:"Slovenia",desc_en:"",name_ru:"Словения",desc_ru:""},{mask:"+421(###)###-###",cc:"SK",cd:"Slovakia",desc_en:"",name_ru:"Словакия",desc_ru:""},{mask:"+232-##-######",cc:"SL",cd:"Sierra Leone",desc_en:"",name_ru:"Сьерра-Леоне",desc_ru:""},{mask:"+378-####-######",cc:"SM",cd:"San Marino",desc_en:"",name_ru:"Сан-Марино",desc_ru:""},{mask:"+221-##-###-####",cc:"SN",cd:"Senegal",desc_en:"",name_ru:"Сенегал",desc_ru:""},{mask:"+252-##-###-###",cc:"SO",cd:"Somalia",desc_en:"",name_ru:"Сомали",desc_ru:""},{mask:"+252-#-###-###",cc:"SO",cd:"Somalia",desc_en:"",name_ru:"Сомали",desc_ru:""},{mask:"+252-#-###-###",cc:"SO",cd:"Somalia ",desc_en:"mobile",name_ru:"Сомали ",desc_ru:"мобильные"},{mask:"+597-###-####",cc:"SR",cd:"Suriname ",desc_en:"mobile",name_ru:"Суринам ",desc_ru:"мобильные"},{mask:"+597-###-###",cc:"SR",cd:"Suriname",desc_en:"",name_ru:"Суринам",desc_ru:""},{mask:"+211-##-###-####",cc:"SS",cd:"South Sudan",desc_en:"",name_ru:"Южный Судан",desc_ru:""},{mask:"+239-##-#####",cc:"ST",cd:"Sao Tome and Principe",desc_en:"",name_ru:"Сан-Томе и Принсипи",desc_ru:""},{mask:"+503-##-##-####",cc:"SV",cd:"El Salvador",desc_en:"",name_ru:"Сальвадор",desc_ru:""},{mask:"+1(721)###-####",cc:"SX",cd:"Sint Maarten",desc_en:"",name_ru:"Синт-Маартен",desc_ru:""},{mask:"+963-##-####-###",cc:"SY",cd:"Syrian Arab Republic",desc_en:"",name_ru:"Сирийская арабская республика",desc_ru:""},{mask:"+268-##-##-####",cc:"SZ",cd:"Swaziland",desc_en:"",name_ru:"Свазиленд",desc_ru:""},{mask:"+1(649)###-####",cc:"TC",cd:"Turks & Caicos",desc_en:"",name_ru:"Тёркс и Кайкос",desc_ru:""},{mask:"+235-##-##-##-##",cc:"TD",cd:"Chad",desc_en:"",name_ru:"Чад",desc_ru:""},{mask:"+228-##-###-###",cc:"TG",cd:"Togo",desc_en:"",name_ru:"Того",desc_ru:""},{mask:"+66-##-###-####",cc:"TH",cd:"Thailand ",desc_en:"mobile",name_ru:"Таиланд ",desc_ru:"мобильные"},{mask:"+66-##-###-###",cc:"TH",cd:"Thailand",desc_en:"",name_ru:"Таиланд",desc_ru:""},{mask:"+992-##-###-####",cc:"TJ",cd:"Tajikistan",desc_en:"",name_ru:"Таджикистан",desc_ru:""},{mask:"+690-####",cc:"TK",cd:"Tokelau",desc_en:"",name_ru:"Токелау",desc_ru:""},{mask:"+670-###-####",cc:"TL",cd:"East Timor",desc_en:"",name_ru:"Восточный Тимор",desc_ru:""},{mask:"+670-77#-#####",cc:"TL",cd:"East Timor",desc_en:"Timor Telecom",name_ru:"Восточный Тимор",desc_ru:"Timor Telecom"},{mask:"+670-78#-#####",cc:"TL",cd:"East Timor",desc_en:"Timor Telecom",name_ru:"Восточный Тимор",desc_ru:"Timor Telecom"},{mask:"+993-#-###-####",cc:"TM",cd:"Turkmenistan",desc_en:"",name_ru:"Туркменистан",desc_ru:""},{mask:"+216-##-###-###",cc:"TN",cd:"Tunisia",desc_en:"",name_ru:"Тунис",desc_ru:""},{mask:"+676-#####",cc:"TO",cd:"Tonga",desc_en:"",name_ru:"Тонга",desc_ru:""},{mask:"+90(###)###-####",cc:"TR",cd:"Turkey",desc_en:"",name_ru:"Турция",desc_ru:""},{mask:"+1(868)###-####",cc:"TT",cd:"Trinidad & Tobago",desc_en:"",name_ru:"Тринидад и Тобаго",desc_ru:""},{mask:"+688-90####",cc:"TV",cd:"Tuvalu ",desc_en:"mobile",name_ru:"Тувалу ",desc_ru:"мобильные"},{mask:"+688-2####",cc:"TV",cd:"Tuvalu",desc_en:"",name_ru:"Тувалу",desc_ru:""},{mask:"+886-#-####-####",cc:"TW",cd:"Taiwan",desc_en:"",name_ru:"Тайвань",desc_ru:""},{mask:"+886-####-####",cc:"TW",cd:"Taiwan",desc_en:"",name_ru:"Тайвань",desc_ru:""},{mask:"+255-##-###-####",cc:"TZ",cd:"Tanzania",desc_en:"",name_ru:"Танзания",desc_ru:""},{mask:"+380(##)###-##-##",cc:"UA",cd:"Ukraine",desc_en:"",name_ru:"Украина",desc_ru:""},{mask:"+256(###)###-###",cc:"UG",cd:"Uganda",desc_en:"",name_ru:"Уганда",desc_ru:""},{mask:"+44-##-####-####",cc:"UK",cd:"United Kingdom",desc_en:"",name_ru:"Великобритания",desc_ru:""},{mask:"+598-#-###-##-##",cc:"UY",cd:"Uruguay",desc_en:"",name_ru:"Уругвай",desc_ru:""},{mask:"+998-##-###-####",cc:"UZ",cd:"Uzbekistan",desc_en:"",name_ru:"Узбекистан",desc_ru:""},{mask:"+39-6-698-#####",cc:"VA",cd:"Vatican City",desc_en:"",name_ru:"Ватикан",desc_ru:""},{mask:"+1(784)###-####",cc:"VC",cd:"Saint Vincent & the Grenadines",desc_en:"",name_ru:"Сент-Винсент и Гренадины",desc_ru:""},{mask:"+58(###)###-####",cc:"VE",cd:"Venezuela",desc_en:"",name_ru:"Венесуэла",desc_ru:""},{mask:"+1(284)###-####",cc:"VG",cd:"British Virgin Islands",desc_en:"",name_ru:"Британские Виргинские острова",desc_ru:""},{mask:"+1(340)###-####",cc:"VI",cd:"US Virgin Islands",desc_en:"",name_ru:"Американские Виргинские острова",desc_ru:""},{mask:"+84-##-####-###",cc:"VN",cd:"Vietnam",desc_en:"",name_ru:"Вьетнам",desc_ru:""},{mask:"+84(###)####-###",cc:"VN",cd:"Vietnam",desc_en:"",name_ru:"Вьетнам",desc_ru:""},{mask:"+678-##-#####",cc:"VU",cd:"Vanuatu ",desc_en:"mobile",name_ru:"Вануату ",desc_ru:"мобильные"},{mask:"+678-#####",cc:"VU",cd:"Vanuatu",desc_en:"",name_ru:"Вануату",desc_ru:""},{mask:"+681-##-####",cc:"WF",cd:"Wallis and Futuna",desc_en:"",name_ru:"Уоллис и Футуна",desc_ru:""},{mask:"+685-##-####",cc:"WS",cd:"Samoa",desc_en:"",name_ru:"Самоа",desc_ru:""},{mask:"+967-###-###-###",cc:"YE",cd:"Yemen ",desc_en:"mobile",name_ru:"Йемен ",desc_ru:"мобильные"},{mask:"+967-#-###-###",cc:"YE",cd:"Yemen",desc_en:"",name_ru:"Йемен",desc_ru:""},{mask:"+967-##-###-###",cc:"YE",cd:"Yemen",desc_en:"",name_ru:"Йемен",desc_ru:""},{mask:"+27-##-###-####",cc:"ZA",cd:"South Africa",desc_en:"",name_ru:"Южно-Африканская Респ.",desc_ru:""},{mask:"+260-##-###-####",cc:"ZM",cd:"Zambia",desc_en:"",name_ru:"Замбия",desc_ru:""},{mask:"+263-#-######",cc:"ZW",cd:"Zimbabwe",desc_en:"",name_ru:"Зимбабве",desc_ru:""},{mask:"+1(###)###-####",cc:["US","CA"],cd:"USA and Canada",desc_en:"",name_ru:"США и Канада",desc_ru:""}]}}),c});
/*!
* phone-codes/phone-ru.min.js
* https://github.com/RobinHerbots/Inputmask
* Copyright (c) 2010 - 2017 Robin Herbots
* Licensed under the MIT license (http://www.opensource.org/licenses/mit-license.php)
* Version: 3.3.11
*/

!function(c){"function"==typeof define&&define.amd?define(["../inputmask"],c):"object"==typeof exports?module.exports=c(require("../inputmask")):c(window.Inputmask)}(function(c){return c.extendAliases({phoneru:{alias:"abstractphone",countrycode:"7",phoneCodes:[{mask:"+7(301)###-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"",operator:"",desc:""},{mask:"+7(3012)##-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Улан-Удэ",operator:"",desc:""},{mask:"+7(30130)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:["Нижнеангарск","Северобайкальск"],operator:"",desc:""},{mask:"+7(30131)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Баргузин",operator:"",desc:""},{mask:"+7(30132)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Таксимо",operator:"",desc:""},{mask:"+7(30133)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Бичура",operator:"",desc:""},{mask:"+7(30134)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Петропавловка",operator:"",desc:""},{mask:"+7(30135)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Сосново-Озёрское",operator:"",desc:""},{mask:"+7(30136)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Заиграево",operator:"",desc:""},{mask:"+7(30137)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Закаменск",operator:"",desc:""},{mask:"+7(30138)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Кабанск",operator:"",desc:""},{mask:"+7(30140)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Иволгинск",operator:"",desc:""},{mask:"+7(30141)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Кижинга",operator:"",desc:""},{mask:"+7(30142)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Кяхта",operator:"",desc:""},{mask:"+7(30143)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Мухоршибирь",operator:"",desc:""},{mask:"+7(30144)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Турунтаево",operator:"",desc:""},{mask:"+7(30145)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Гусиноозёрск",operator:"",desc:""},{mask:"+7(30146)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Тарбагатай",operator:"",desc:""},{mask:"+7(30147)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Кырен",operator:"",desc:""},{mask:"+7(30148)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Хоринск",operator:"",desc:""},{mask:"+7(30149)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Курумкан",operator:"",desc:""},{mask:"+7(30150)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Орлик",operator:"",desc:""},{mask:"+7(30153)#-##-##",cc:"RU",cd:"Russia",region:"Бурятия",city:"Багдарин",operator:"",desc:""},{mask:"+7(302)###-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"",operator:"",desc:""},{mask:"+7(3022)##-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Чита",operator:"",desc:""},{mask:"+7(30230)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Красный Чикой",operator:"",desc:""},{mask:"+7(30231)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Акша",operator:"",desc:""},{mask:"+7(30232)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Балей",operator:"",desc:""},{mask:"+7(30233)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Борзя",operator:"",desc:""},{mask:"+7(30234)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Карымское",operator:"",desc:""},{mask:"+7(30235)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Кыра",operator:"",desc:""},{mask:"+7(30236)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Петровск-Забайкальский",operator:"",desc:""},{mask:"+7(30237)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Хилок",operator:"",desc:""},{mask:"+7(30238)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Улёты",operator:"",desc:""},{mask:"+7(30239)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Агинское",operator:"",desc:""},{mask:"+7(30240)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Александровский Завод",operator:"",desc:""},{mask:"+7(30241)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Могоча",operator:"",desc:""},{mask:"+7(30242)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Нерчинск",operator:"",desc:""},{mask:"+7(30243)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Приаргунск",operator:"",desc:""},{mask:"+7(30244)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Шилка",operator:"",desc:""},{mask:"+7(30245)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Краснокаменск",operator:"",desc:""},{mask:"+7(30246)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Сретенск",operator:"",desc:""},{mask:"+7(30247)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Газимурский Завод",operator:"",desc:""},{mask:"+7(30248)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Нерчинский Завод",operator:"",desc:""},{mask:"+7(30249)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Калга",operator:"",desc:""},{mask:"+7(30251)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Забайкальск",operator:"",desc:""},{mask:"+7(30252)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Нижний Цасучей",operator:"",desc:""},{mask:"+7(30253)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Оловянная",operator:"",desc:""},{mask:"+7(30255)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Могойтуй",operator:"",desc:""},{mask:"+7(30256)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Дульдурга",operator:"",desc:""},{mask:"+7(30257)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Горный",operator:"",desc:""},{mask:"+7(30261)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:["Калар","Чара"],operator:"",desc:""},{mask:"+7(30262)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Первомайский",operator:"",desc:""},{mask:"+7(30264)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Верх-Усугли",operator:"",desc:""},{mask:"+7(30265)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Чернышевск",operator:"",desc:""},{mask:"+7(30266)#-##-##",cc:"RU",cd:"Russia",region:"Забайкальский край",city:"Шелопугино",operator:"",desc:""},{mask:"+7(341)###-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"",operator:"",desc:""},{mask:"+7(3412)##-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Ижевск",operator:"",desc:""},{mask:"+7(34126)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Завьялово",operator:"",desc:""},{mask:"+7(34130)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Ува",operator:"",desc:""},{mask:"+7(34132)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Каракулино",operator:"",desc:""},{mask:"+7(34133)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Киясово",operator:"",desc:""},{mask:"+7(34134)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Игра",operator:"",desc:""},{mask:"+7(34136)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Шаркан",operator:"",desc:""},{mask:"+7(34138)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Малая Пурга",operator:"",desc:""},{mask:"+7(34139)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Можга",operator:"",desc:""},{mask:"+7(34141)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Глазов",operator:"",desc:""},{mask:"+7(34145)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Воткинск",operator:"",desc:""},{mask:"+7(34147)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Сарапул",operator:"",desc:""},{mask:"+7(34150)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Алнаши",operator:"",desc:""},{mask:"+7(34151)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Дебёсы",operator:"",desc:""},{mask:"+7(34152)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Сюмси",operator:"",desc:""},{mask:"+7(34153)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Камбарка",operator:"",desc:""},{mask:"+7(34154)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Кизнер",operator:"",desc:""},{mask:"+7(34155)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Вавож",operator:"",desc:""},{mask:"+7(34157)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Яр",operator:"",desc:""},{mask:"+7(34158)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Кез",operator:"",desc:""},{mask:"+7(34159)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Селты",operator:"",desc:""},{mask:"+7(34161)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Юкаменское",operator:"",desc:""},{mask:"+7(34162)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Якшур-Бодья",operator:"",desc:""},{mask:"+7(34163)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Грахово",operator:"",desc:""},{mask:"+7(34164)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Красногорское",operator:"",desc:""},{mask:"+7(34166)#-##-##",cc:"RU",cd:"Russia",region:"Удмуртская Республика",city:"Балезино",operator:"",desc:""},{mask:"+7(342)###-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"",operator:"",desc:""},{mask:"+7(342)2##-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Пермь",operator:"",desc:""},{mask:"+7(342)3##-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Пермь",operator:"",desc:""},{mask:"+7(3424)2#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Березники",operator:"",desc:""},{mask:"+7(34240)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Чердынь",operator:"",desc:""},{mask:"+7(34241)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Чайковский",operator:"",desc:""},{mask:"+7(34243)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Красновишерск",operator:"",desc:""},{mask:"+7(34244)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Усолье",operator:"",desc:""},{mask:"+7(34245)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Гайны",operator:"",desc:""},{mask:"+7(34246)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Юсьва",operator:"",desc:""},{mask:"+7(34248)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Губаха",operator:"",desc:""},{mask:"+7(34249)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Лысьва",operator:"",desc:""},{mask:"+7(34250)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Гремячинск",operator:"",desc:""},{mask:"+7(34251)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Березовка",operator:"",desc:""},{mask:"+7(34252)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Усть-Кишерть",operator:"",desc:""},{mask:"+7(34253)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Соликамск",operator:"",desc:""},{mask:"+7(34254)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Верещагино",operator:"",desc:""},{mask:"+7(34255)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Кизел",operator:"",desc:""},{mask:"+7(34256)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Чусовой",operator:"",desc:""},{mask:"+7(34257)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Большая Соснова",operator:"",desc:""},{mask:"+7(34258)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Орда",operator:"",desc:""},{mask:"+7(34259)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Уинское",operator:"",desc:""},{mask:"+7(34260)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Кудымкар",operator:"",desc:""},{mask:"+7(34261)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Чернушка",operator:"",desc:""},{mask:"+7(34262)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Куеда",operator:"",desc:""},{mask:"+7(34263)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Звёздный",operator:"",desc:""},{mask:"+7(34265)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Добрянка",operator:"",desc:""},{mask:"+7(34266)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Октябрьский",operator:"",desc:""},{mask:"+7(34268)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Частые",operator:"",desc:""},{mask:"+7(34269)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Горнозаводск",operator:"",desc:""},{mask:"+7(34271)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Кунгур",operator:"",desc:""},{mask:"+7(34272)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Нытва",operator:"",desc:""},{mask:"+7(34273)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Краснокамск",operator:"",desc:""},{mask:"+7(34274)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Александровск",operator:"",desc:""},{mask:"+7(34275)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Суксун",operator:"",desc:""},{mask:"+7(34276)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Ильинский",operator:"",desc:""},{mask:"+7(34277)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Сива",operator:"",desc:""},{mask:"+7(34278)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Очер",operator:"",desc:""},{mask:"+7(34279)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Оханск",operator:"",desc:""},{mask:"+7(34291)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Оса",operator:"",desc:""},{mask:"+7(34292)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Барда",operator:"",desc:""},{mask:"+7(34293)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Кочёво",operator:"",desc:""},{mask:"+7(34294)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Юрла",operator:"",desc:""},{mask:"+7(34296)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Елово",operator:"",desc:""},{mask:"+7(34297)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Карагай",operator:"",desc:""},{mask:"+7(34298)#-##-##",cc:"RU",cd:"Russia",region:"Пермский край",city:"Коса",operator:"",desc:""},{mask:"+7(343)###-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"",operator:"",desc:""},{mask:"+7(343)2##-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Екатеринбург",operator:"",desc:""},{mask:"+7(343)3##-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Екатеринбург",operator:"",desc:""},{mask:"+7(34341)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Качканар",operator:"",desc:""},{mask:"+7(34342)2-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Нижняя Тура",operator:"",desc:""},{mask:"+7(34342)3-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Лесной",operator:"",desc:""},{mask:"+7(34342)5-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Лесной",operator:"",desc:""},{mask:"+7(34342)6-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Лесной",operator:"",desc:""},{mask:"+7(34343)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Красноуральск",operator:"",desc:""},{mask:"+7(34344)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Кушва",operator:"",desc:""},{mask:"+7(34345)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Верхняя Салда",operator:"",desc:""},{mask:"+7(34346)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Алапаевск",operator:"",desc:""},{mask:"+7(34347)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Таборы",operator:"",desc:""},{mask:"+7(34349)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Туринск",operator:"",desc:""},{mask:"+7(3435)##-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Нижний Тагил",operator:"",desc:""},{mask:"+7(34350)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Полевской",operator:"",desc:""},{mask:"+7(34355)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Ирбит",operator:"",desc:""},{mask:"+7(34356)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Невьянск",operator:"",desc:""},{mask:"+7(34357)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Кировград",operator:"",desc:""},{mask:"+7(34358)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Шаля",operator:"",desc:""},{mask:"+7(34360)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Тавда",operator:"",desc:""},{mask:"+7(34361)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Туринская Слобода",operator:"",desc:""},{mask:"+7(34362)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Байкалово",operator:"",desc:""},{mask:"+7(34363)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Артемовский",operator:"",desc:""},{mask:"+7(34364)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Реж",operator:"",desc:""},{mask:"+7(34365)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Асбест",operator:"",desc:""},{mask:"+7(34367)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Тугулым",operator:"",desc:""},{mask:"+7(34368)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Верхняя Пышма",operator:"",desc:""},{mask:"+7(34369)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Берёзовский",operator:"",desc:""},{mask:"+7(34370)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Новоуральск",operator:"",desc:""},{mask:"+7(34371)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Талица",operator:"",desc:""},{mask:"+7(34372)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Пышма",operator:"",desc:""},{mask:"+7(34373)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Сухой Лог",operator:"",desc:""},{mask:"+7(34374)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Сысерть",operator:"",desc:""},{mask:"+7(34375)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Камышлов",operator:"",desc:""},{mask:"+7(34376)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Богданович",operator:"",desc:""},{mask:"+7(34377)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Белоярский",operator:"",desc:""},{mask:"+7(34380)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Североуральск",operator:"",desc:""},{mask:"+7(34383)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Карпинск",operator:"",desc:""},{mask:"+7(34383)5-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Волчанск",operator:"",desc:""},{mask:"+7(34384)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Краснотурьинск",operator:"",desc:""},{mask:"+7(34385)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Серов",operator:"",desc:""},{mask:"+7(34386)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Ивдель",operator:"",desc:""},{mask:"+7(34387)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Гари",operator:"",desc:""},{mask:"+7(34388)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Новая Ляля",operator:"",desc:""},{mask:"+7(34389)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Верхотурье",operator:"",desc:""},{mask:"+7(3439)2#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Первоуральск",operator:"",desc:""},{mask:"+7(3439)3#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Каменск-Уральский",operator:"",desc:""},{mask:"+7(3439)54-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Каменск-Уральский",operator:"",desc:""},{mask:"+7(3439)6#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Первоуральск",operator:"",desc:""},{mask:"+7(34391)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Ачит",operator:"",desc:""},{mask:"+7(34394)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Красноуфимск",operator:"",desc:""},{mask:"+7(34395)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Арти",operator:"",desc:""},{mask:"+7(34397)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Ревда",operator:"",desc:""},{mask:"+7(34398)#-##-##",cc:"RU",cd:"Russia",region:"Свердловская область",city:"Нижние Серги",operator:"",desc:""},{mask:"+7(345)###-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"",operator:"",desc:""},{mask:"+7(3452)##-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Тюмень",operator:"",desc:""},{mask:"+7(34531)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Ярково",operator:"",desc:""},{mask:"+7(34533)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Нижняя Тавда",operator:"",desc:""},{mask:"+7(34535)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Ялуторовск",operator:"",desc:""},{mask:"+7(34537)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Исетское",operator:"",desc:""},{mask:"+7(34539)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Вагай",operator:"",desc:""},{mask:"+7(34541)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Упорово",operator:"",desc:""},{mask:"+7(34542)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Заводоуковск",operator:"",desc:""},{mask:"+7(34543)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Юргинское",operator:"",desc:""},{mask:"+7(34544)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Омутинское",operator:"",desc:""},{mask:"+7(34545)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Аромашево",operator:"",desc:""},{mask:"+7(34546)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Голышманово",operator:"",desc:""},{mask:"+7(34547)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Армизонское",operator:"",desc:""},{mask:"+7(34550)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Большое Сорокино",operator:"",desc:""},{mask:"+7(34551)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Ишим",operator:"",desc:""},{mask:"+7(34553)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Казанское",operator:"",desc:""},{mask:"+7(34554)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Бердюжье",operator:"",desc:""},{mask:"+7(34555)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Сладково",operator:"",desc:""},{mask:"+7(34556)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Абатский",operator:"",desc:""},{mask:"+7(34557)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Викулово",operator:"",desc:""},{mask:"+7(3456)##-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Тобольск",operator:"",desc:""},{mask:"+7(34561)#-##-##",cc:"RU",cd:"Russia",region:"Тюменская область",city:"Уват",operator:"",desc:""},{mask:"+7(346)###-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"",operator:"",desc:""},{mask:"+7(3462)##-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Сургут",operator:"",desc:""},{mask:"+7(3463)##-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Нефтеюганск",operator:"",desc:""},{mask:"+7(34634)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Пыть-Ях",operator:"",desc:""},{mask:"+7(34638)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Лянтор",operator:"",desc:""},{mask:"+7(34643)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Мегион",operator:"",desc:""},{mask:"+7(3466)##-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Нижневартовск",operator:"",desc:""},{mask:"+7(34667)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Когалым",operator:"",desc:""},{mask:"+7(34668)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Радужный",operator:"",desc:""},{mask:"+7(34669)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Лангепас",operator:"",desc:""},{mask:"+7(34670)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Белоярский",operator:"",desc:""},{mask:"+7(34672)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Нягань",operator:"",desc:""},{mask:"+7(34673)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Ханты-Мансийск",operator:"",desc:""},{mask:"+7(34674)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Берёзово",operator:"",desc:""},{mask:"+7(34675)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Советский",operator:"",desc:""},{mask:"+7(34676)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Урай",operator:"",desc:""},{mask:"+7(34677)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Кондинское",operator:"",desc:""},{mask:"+7(34678)#-##-##",cc:"RU",cd:"Russia",region:"Ханты-Мансийский автономный округ",city:"Октябрьское",operator:"",desc:""},{mask:"+7(347)###-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"",operator:"",desc:""},{mask:"+7(347)2##-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Уфа",operator:"",desc:""},{mask:"+7(3473)##-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Стерлитамак",operator:"",desc:""},{mask:"+7(34731)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Агидель",operator:"",desc:""},{mask:"+7(34739)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Стерлибашево",operator:"",desc:""},{mask:"+7(34740)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Красноусольский",operator:"",desc:""},{mask:"+7(34741)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Ермекеево",operator:"",desc:""},{mask:"+7(34742)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Бакалы",operator:"",desc:""},{mask:"+7(34743)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Бижбуляк",operator:"",desc:""},{mask:"+7(34744)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Караидель",operator:"",desc:""},{mask:"+7(34745)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Толбазы",operator:"",desc:""},{mask:"+7(34746)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Фёдоровка",operator:"",desc:""},{mask:"+7(34747)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Языково",operator:"",desc:""},{mask:"+7(34748)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Верхние Киги",operator:"",desc:""},{mask:"+7(34749)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Мишкино",operator:"",desc:""},{mask:"+7(34750)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Новобелокатай",operator:"",desc:""},{mask:"+7(34751)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Баймак",operator:"",desc:""},{mask:"+7(34752)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Зилаир",operator:"",desc:""},{mask:"+7(34753)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Старобалтачево",operator:"",desc:""},{mask:"+7(34754)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Раевский",operator:"",desc:""},{mask:"+7(34755)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Старосубхангулово",operator:"",desc:""},{mask:"+7(34756)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Бураево",operator:"",desc:""},{mask:"+7(34757)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Ермолаево",operator:"",desc:""},{mask:"+7(34758)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Акъяр",operator:"",desc:""},{mask:"+7(34759)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Николо-Березовка",operator:"",desc:""},{mask:"+7(34760)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Янаул",operator:"",desc:""},{mask:"+7(34761)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Кумертау",operator:"",desc:""},{mask:"+7(34762)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Верхнеяркеево",operator:"",desc:""},{mask:"+7(34763)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Салават",operator:"",desc:""},{mask:"+7(34764)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Мелеуз",operator:"",desc:""},{mask:"+7(34765)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Кармаскалы",operator:"",desc:""},{mask:"+7(34766)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Благовещенск",operator:"",desc:""},{mask:"+7(34767)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Октябрьский",operator:"",desc:""},{mask:"+7(34768)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Давлеканово",operator:"",desc:""},{mask:"+7(34769)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Шаран",operator:"",desc:""},{mask:"+7(34770)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Большеустьикинское",operator:"",desc:""},{mask:"+7(34771)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Аскино",operator:"",desc:""},{mask:"+7(34772)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Аскарово",operator:"",desc:""},{mask:"+7(34773)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Буздяк",operator:"",desc:""},{mask:"+7(34774)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Архангельское",operator:"",desc:""},{mask:"+7(34775)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Сибай",operator:"",desc:""},{mask:"+7(34776)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Красная Горка",operator:"",desc:""},{mask:"+7(34777)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Малояз",operator:"",desc:""},{mask:"+7(34778)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Верхние Татышлы",operator:"",desc:""},{mask:"+7(34779)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Калтасы",operator:"",desc:""},{mask:"+7(34780)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Кушнаренково",operator:"",desc:""},{mask:"+7(34781)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Межгорье",operator:"",desc:""},{mask:"+7(34782)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Туймазы",operator:"",desc:""},{mask:"+7(34783)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Нефтекамск",operator:"",desc:""},{mask:"+7(34784)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Бирск",operator:"",desc:""},{mask:"+7(34785)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Исянгулово",operator:"",desc:""},{mask:"+7(34786)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Белебей",operator:"",desc:""},{mask:"+7(34787)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Дюртюли",operator:"",desc:""},{mask:"+7(34788)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Киргиз-Мияки",operator:"",desc:""},{mask:"+7(34789)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Мраково",operator:"",desc:""},{mask:"+7(34791)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Учалы",operator:"",desc:""},{mask:"+7(34792)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Белорецк",operator:"",desc:""},{mask:"+7(34794)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Ишимбай",operator:"",desc:""},{mask:"+7(34795)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Иглино",operator:"",desc:""},{mask:"+7(34796)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Чекмагуш",operator:"",desc:""},{mask:"+7(34797)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Чишмы",operator:"",desc:""},{mask:"+7(34798)#-##-##",cc:"RU",cd:"Russia",region:"Республика Башкортостан",city:"Месягутово",operator:"",desc:""},{mask:"+7(349)###-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"",operator:"",desc:""},{mask:"+7(34922)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Салехард",operator:"",desc:""},{mask:"+7(34932)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Красноселькуп",operator:"",desc:""},{mask:"+7(34934)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Уренгой",operator:"",desc:""},{mask:"+7(34936)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Губкинский",operator:"",desc:""},{mask:"+7(34938)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Муравленко",operator:"",desc:""},{mask:"+7(3494)##-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Новый Уренгой",operator:"",desc:""},{mask:"+7(34940)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Тазовский",operator:"",desc:""},{mask:"+7(34948)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Харп",operator:"",desc:""},{mask:"+7(34949)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Ямбург",operator:"",desc:""},{mask:"+7(3496)##-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Ноябрьск",operator:"",desc:""},{mask:"+7(34992)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Лабытнанги",operator:"",desc:""},{mask:"+7(34993)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Аксарка",operator:"",desc:""},{mask:"+7(34994)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Мужи",operator:"",desc:""},{mask:"+7(34995)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Надым",operator:"",desc:""},{mask:"+7(34996)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Яр-Сале",operator:"",desc:""},{mask:"+7(34997)#-##-##",cc:"RU",cd:"Russia",region:"Ямало-Ненецкий автономный округ",city:"Тарко-Сале",operator:"",desc:""},{mask:"+7(351)###-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"",operator:"",desc:""},{mask:"+7(351)2##-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Челябинск",operator:"",desc:""},{mask:"+7(351)301-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Челябинск",operator:"",desc:""},{mask:"+7(351)7##-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Челябинск",operator:"",desc:""},{mask:"+7(351)90#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"",operator:"Ростелеком",desc:"мобильные телефоны с зоновыми номерами"},{mask:"+7(3513)2#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Миасс",operator:"",desc:""},{mask:"+7(3513)5#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Миасс",operator:"",desc:""},{mask:"+7(3513)6#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Златоуст",operator:"",desc:""},{mask:"+7(3513)7#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Златоуст",operator:"",desc:""},{mask:"+7(35130)2-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Озёрск",operator:"",desc:""},{mask:"+7(35130)4-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Озёрск",operator:"",desc:""},{mask:"+7(35130)6-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Озёрск",operator:"",desc:""},{mask:"+7(35130)7-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Озёрск",operator:"",desc:""},{mask:"+7(35130)9-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Озёрск",operator:"",desc:""},{mask:"+7(35131)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Аргаяш",operator:"",desc:""},{mask:"+7(35133)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Карталы",operator:"",desc:""},{mask:"+7(35134)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Южноуральск",operator:"",desc:""},{mask:"+7(35138)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Еманжелинск",operator:"",desc:""},{mask:"+7(35139)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Копейск",operator:"",desc:""},{mask:"+7(35140)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Агаповка",operator:"",desc:""},{mask:"+7(35141)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Бреды",operator:"",desc:""},{mask:"+7(35142)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Варна",operator:"",desc:""},{mask:"+7(35143)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Верхнеуральск",operator:"",desc:""},{mask:"+7(35144)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Долгодеревенское",operator:"",desc:""},{mask:"+7(35145)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Еткуль",operator:"",desc:""},{mask:"+7(35146)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Снежинск",operator:"",desc:""},{mask:"+7(35147)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:["Катав-Ивановск","Юрюзань"],operator:"",desc:""},{mask:"+7(35148)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Кунашак",operator:"",desc:""},{mask:"+7(35149)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Касли",operator:"",desc:""},{mask:"+7(35150)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Миасское",operator:"",desc:""},{mask:"+7(35151)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Кыштым",operator:"",desc:""},{mask:"+7(35152)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Коркино",operator:"",desc:""},{mask:"+7(35153)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Карабаш",operator:"",desc:""},{mask:"+7(35154)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Куса",operator:"",desc:""},{mask:"+7(35155)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Кизильское",operator:"",desc:""},{mask:"+7(35156)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Нязепетровск",operator:"",desc:""},{mask:"+7(35157)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Фершампенуаз",operator:"",desc:""},{mask:"+7(35158)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Октябрьское",operator:"",desc:""},{mask:"+7(35159)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Аша",operator:"",desc:""},{mask:"+7(35160)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Пласт",operator:"",desc:""},{mask:"+7(35161)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Сатка",operator:"",desc:""},{mask:"+7(35163)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Троицк",operator:"",desc:""},{mask:"+7(35164)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Верхний Уфалей",operator:"",desc:""},{mask:"+7(35165)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Уйское",operator:"",desc:""},{mask:"+7(35166)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Увельский",operator:"",desc:""},{mask:"+7(35167)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Усть-Катав",operator:"",desc:""},{mask:"+7(35168)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Чебаркуль",operator:"",desc:""},{mask:"+7(35169)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Чесма",operator:"",desc:""},{mask:"+7(3519)##-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Магнитогорск",operator:"",desc:""},{mask:"+7(35191)#-##-##",cc:"RU",cd:"Russia",region:"Челябинская область",city:"Трёхгорный",operator:"",desc:""},{mask:"+7(352)###-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"",operator:"",desc:""},{mask:"+7(3522)##-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Курган",operator:"",desc:""},{mask:"+7(35230)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Частоозерье",operator:"",desc:""},{mask:"+7(35231)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Кетово",operator:"",desc:""},{mask:"+7(35232)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Белозерское",operator:"",desc:""},{mask:"+7(35233)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Варгаши",operator:"",desc:""},{mask:"+7(35234)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Мокроусово",operator:"",desc:""},{mask:"+7(35235)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Петухово",operator:"",desc:""},{mask:"+7(35236)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Макушино",operator:"",desc:""},{mask:"+7(35237)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Лебяжье",operator:"",desc:""},{mask:"+7(35238)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Половинное",operator:"",desc:""},{mask:"+7(35239)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Глядянское",operator:"",desc:""},{mask:"+7(35240)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Звериноголовское",operator:"",desc:""},{mask:"+7(35241)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Целинное",operator:"",desc:""},{mask:"+7(35242)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Альменево",operator:"",desc:""},{mask:"+7(35243)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Сафакулево",operator:"",desc:""},{mask:"+7(35244)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Щучье",operator:"",desc:""},{mask:"+7(35245)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Шумиха",operator:"",desc:""},{mask:"+7(35247)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Мишкино",operator:"",desc:""},{mask:"+7(35248)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Юргамыш",operator:"",desc:""},{mask:"+7(35249)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Куртамыш",operator:"",desc:""},{mask:"+7(35251)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Катайск",operator:"",desc:""},{mask:"+7(35252)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Далматово",operator:"",desc:""},{mask:"+7(35253)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Шадринск",operator:"",desc:""},{mask:"+7(35256)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Каргаполье",operator:"",desc:""},{mask:"+7(35257)#-##-##",cc:"RU",cd:"Russia",region:"Курганская область",city:"Шатрово",operator:"",desc:""},{mask:"+7(353)###-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"",operator:"",desc:""},{mask:"+7(3532)##-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Оренбург",operator:"",desc:""},{mask:"+7(35330)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Октябрьское",operator:"",desc:""},{mask:"+7(35331)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Сакмара",operator:"",desc:""},{mask:"+7(35332)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Тюльган",operator:"",desc:""},{mask:"+7(35333)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Саракташ",operator:"",desc:""},{mask:"+7(35334)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Беляевка",operator:"",desc:""},{mask:"+7(35335)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Акбулак",operator:"",desc:""},{mask:"+7(35336)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Соль-Илецк",operator:"",desc:""},{mask:"+7(35337)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Илек",operator:"",desc:""},{mask:"+7(35338)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Переволоцкий",operator:"",desc:""},{mask:"+7(35339)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Новосергиевка",operator:"",desc:""},{mask:"+7(35341)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Курманаевка",operator:"",desc:""},{mask:"+7(35342)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Бузулук",operator:"",desc:""},{mask:"+7(35344)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Грачёвка",operator:"",desc:""},{mask:"+7(35345)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Плешаново",operator:"",desc:""},{mask:"+7(35346)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Сорочинск",operator:"",desc:""},{mask:"+7(35347)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Ташла",operator:"",desc:""},{mask:"+7(35348)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Первомайский",operator:"",desc:""},{mask:"+7(35349)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Тоцкое",operator:"",desc:""},{mask:"+7(35351)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Асекеево",operator:"",desc:""},{mask:"+7(35352)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Бугуруслан",operator:"",desc:""},{mask:"+7(35354)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Северное",operator:"",desc:""},{mask:"+7(35355)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Абдулино",operator:"",desc:""},{mask:"+7(35356)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Матвеевка",operator:"",desc:""},{mask:"+7(35357)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Пономаревка",operator:"",desc:""},{mask:"+7(35358)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Шарлык",operator:"",desc:""},{mask:"+7(35359)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Александровка",operator:"",desc:""},{mask:"+7(35361)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Кувандык",operator:"",desc:""},{mask:"+7(35362)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Гай",operator:"",desc:""},{mask:"+7(35363)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Новоорск",operator:"",desc:""},{mask:"+7(35364)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Кваркено",operator:"",desc:""},{mask:"+7(35365)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Адамовка",operator:"",desc:""},{mask:"+7(35366)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Светлый",operator:"",desc:""},{mask:"+7(35367)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Домбаровский",operator:"",desc:""},{mask:"+7(35368)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Ясный",operator:"",desc:""},{mask:"+7(3537)2#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Орск",operator:"",desc:""},{mask:"+7(3537)3#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Орск",operator:"",desc:""},{mask:"+7(3537)4#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Орск",operator:"",desc:""},{mask:"+7(3537)6#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Новотроицк",operator:"",desc:""},{mask:"+7(35379)#-##-##",cc:"RU",cd:"Russia",region:"Оренбургская область",city:"Медногорск",operator:"",desc:""},{mask:"+7(381)###-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"",operator:"",desc:""},{mask:"+7(3812)##-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Омск",operator:"",desc:""},{mask:"+7(38141)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Азово",operator:"",desc:""},{mask:"+7(38150)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Усть-Ишим",operator:"",desc:""},{mask:"+7(38151)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Таврическое",operator:"",desc:""},{mask:"+7(38152)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Нововаршавка",operator:"",desc:""},{mask:"+7(38153)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Черлак",operator:"",desc:""},{mask:"+7(38154)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Тевриз",operator:"",desc:""},{mask:"+7(38155)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Калачинск",operator:"",desc:""},{mask:"+7(38156)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Русская Поляна",operator:"",desc:""},{mask:"+7(38157)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Горьковское",operator:"",desc:""},{mask:"+7(38158)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Муромцево",operator:"",desc:""},{mask:"+7(38159)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Одесское",operator:"",desc:""},{mask:"+7(38160)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Колосовка",operator:"",desc:""},{mask:"+7(38161)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Называевск",operator:"",desc:""},{mask:"+7(38162)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Большие Уки",operator:"",desc:""},{mask:"+7(38163)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Полтавка",operator:"",desc:""},{mask:"+7(38164)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Седельниково",operator:"",desc:""},{mask:"+7(38165)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Нижняя Омка",operator:"",desc:""},{mask:"+7(38166)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Оконешниково",operator:"",desc:""},{mask:"+7(38167)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Крутинка",operator:"",desc:""},{mask:"+7(38168)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Марьяновка",operator:"",desc:""},{mask:"+7(38169)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Большеречье",operator:"",desc:""},{mask:"+7(38170)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Кормиловка",operator:"",desc:""},{mask:"+7(38171)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Тара",operator:"",desc:""},{mask:"+7(38172)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Павлоградка",operator:"",desc:""},{mask:"+7(38173)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Исилькуль",operator:"",desc:""},{mask:"+7(38174)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Москаленки",operator:"",desc:""},{mask:"+7(38175)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Любинский",operator:"",desc:""},{mask:"+7(38176)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Тюкалинск",operator:"",desc:""},{mask:"+7(38177)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Шербакуль",operator:"",desc:""},{mask:"+7(38178)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Саргатское",operator:"",desc:""},{mask:"+7(38179)#-##-##",cc:"RU",cd:"Russia",region:"Омская область",city:"Знаменское",operator:"",desc:""},{mask:"+7(382)###-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"",operator:"",desc:""},{mask:"+7(3822)##-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Томск",operator:"",desc:""},{mask:"+7(3823)##-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Северск",operator:"",desc:""},{mask:"+7(38241)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Асино",operator:"",desc:""},{mask:"+7(38243)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Зырянское",operator:"",desc:""},{mask:"+7(38244)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Кожевниково",operator:"",desc:""},{mask:"+7(38245)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Первомайское",operator:"",desc:""},{mask:"+7(38246)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Тегульдет",operator:"",desc:""},{mask:"+7(38247)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Мельниково",operator:"",desc:""},{mask:"+7(38249)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Бакчар",operator:"",desc:""},{mask:"+7(38250)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Кедровый",operator:"",desc:""},{mask:"+7(38251)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Кривошеино",operator:"",desc:""},{mask:"+7(38252)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Парабель",operator:"",desc:""},{mask:"+7(38253)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Каргасок",operator:"",desc:""},{mask:"+7(38254)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Колпашево",operator:"",desc:""},{mask:"+7(38255)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Александровское",operator:"",desc:""},{mask:"+7(38256)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Молчаново",operator:"",desc:""},{mask:"+7(38257)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Подгорное",operator:"",desc:""},{mask:"+7(38258)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Белый Яр",operator:"",desc:""},{mask:"+7(38259)#-##-##",cc:"RU",cd:"Russia",region:"Томская область",city:"Стрежевой",operator:"",desc:""},{mask:"+7(383)###-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Новосибирск",operator:"",desc:""},{mask:"+7(38340)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Тогучин",operator:"",desc:""},{mask:"+7(38341)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Бердск",operator:"",desc:""},{mask:"+7(38343)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Искитим",operator:"",desc:""},{mask:"+7(38345)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Черепаново",operator:"",desc:""},{mask:"+7(38346)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Сузун",operator:"",desc:""},{mask:"+7(38347)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Маслянино",operator:"",desc:""},{mask:"+7(38348)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Мошково",operator:"",desc:""},{mask:"+7(38349)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Болотное",operator:"",desc:""},{mask:"+7(38350)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Чулым",operator:"",desc:""},{mask:"+7(38351)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Коченево",operator:"",desc:""},{mask:"+7(38352)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Колывань",operator:"",desc:""},{mask:"+7(38353)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Баган",operator:"",desc:""},{mask:"+7(38354)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Довольное",operator:"",desc:""},{mask:"+7(38355)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Карасук",operator:"",desc:""},{mask:"+7(38356)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Кочки",operator:"",desc:""},{mask:"+7(38357)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Краснозерское",operator:"",desc:""},{mask:"+7(38358)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Купино",operator:"",desc:""},{mask:"+7(38359)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Ордынское",operator:"",desc:""},{mask:"+7(38360)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Северное",operator:"",desc:""},{mask:"+7(38361)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Барабинск",operator:"",desc:""},{mask:"+7(38362)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Куйбышев",operator:"",desc:""},{mask:"+7(38363)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Здвинск",operator:"",desc:""},{mask:"+7(38364)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Татарск",operator:"",desc:""},{mask:"+7(38365)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Каргат",operator:"",desc:""},{mask:"+7(38366)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Убинское",operator:"",desc:""},{mask:"+7(38367)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Чаны",operator:"",desc:""},{mask:"+7(38368)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Чистоозерное",operator:"",desc:""},{mask:"+7(38369)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Венгерово",operator:"",desc:""},{mask:"+7(38371)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Кыштовка",operator:"",desc:""},{mask:"+7(38372)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Усть-Тарка",operator:"",desc:""},{mask:"+7(38373)#-##-##",cc:"RU",cd:"Russia",region:"Новосибирская область",city:"Обь",operator:"",desc:""},{mask:"+7(384)###-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"",operator:"",desc:""},{mask:"+7(3842)##-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Кемерово",operator:"",desc:""},{mask:"+7(3843)##-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Новокузнецк",operator:"",desc:""},{mask:"+7(38441)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Яя",operator:"",desc:""},{mask:"+7(38442)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Промышленная",operator:"",desc:""},{mask:"+7(38443)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Мариинск",operator:"",desc:""},{mask:"+7(38444)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Верх-Чебула",operator:"",desc:""},{mask:"+7(38445)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Берёзовский",operator:"",desc:""},{mask:"+7(38446)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Крапивинский",operator:"",desc:""},{mask:"+7(38447)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Тисуль",operator:"",desc:""},{mask:"+7(38448)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Тайга",operator:"",desc:""},{mask:"+7(38449)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Тяжинский",operator:"",desc:""},{mask:"+7(38451)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Юрга",operator:"",desc:""},{mask:"+7(38452)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Белово",operator:"",desc:""},{mask:"+7(38453)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Анжеро-Судженск",operator:"",desc:""},{mask:"+7(38454)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Топки",operator:"",desc:""},{mask:"+7(38455)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Яшкино",operator:"",desc:""},{mask:"+7(38456)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Ленинск-Кузнецкий",operator:"",desc:""},{mask:"+7(38459)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Ижморский",operator:"",desc:""},{mask:"+7(3846)##-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Прокопьевск",operator:"",desc:""},{mask:"+7(38463)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Гурьевск",operator:"",desc:""},{mask:"+7(38464)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Киселевск",operator:"",desc:""},{mask:"+7(38471)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Осинники",operator:"",desc:""},{mask:"+7(38472)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Калтан",operator:"",desc:""},{mask:"+7(38473)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Таштагол",operator:"",desc:""},{mask:"+7(38474)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Мыски",operator:"",desc:""},{mask:"+7(38475)#-##-##",cc:"RU",cd:"Russia",region:"Кемеровская область",city:"Междуреченск",operator:"",desc:""},{mask:"+7(385)###-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"",operator:"",desc:""},{mask:"+7(3852)##-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Барнаул",operator:"",desc:""},{mask:"+7(38530)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Зональное",operator:"",desc:""},{mask:"+7(38531)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Косиха",operator:"",desc:""},{mask:"+7(38532)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Новоалтайск",operator:"",desc:""},{mask:"+7(38533)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Солтон",operator:"",desc:""},{mask:"+7(38534)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Троицкое",operator:"",desc:""},{mask:"+7(38535)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Красногорское",operator:"",desc:""},{mask:"+7(38536)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Смоленское",operator:"",desc:""},{mask:"+7(38537)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Алтайское",operator:"",desc:""},{mask:"+7(38538)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Верх-Суетка",operator:"",desc:""},{mask:"+7(38539)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Гальбштадт",operator:"",desc:""},{mask:"+7(3854)##-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Бийск",operator:"",desc:""},{mask:"+7(38550)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Шипуново",operator:"",desc:""},{mask:"+7(38551)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Калманка",operator:"",desc:""},{mask:"+7(38552)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Топчиха",operator:"",desc:""},{mask:"+7(38553)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Алейск",operator:"",desc:""},{mask:"+7(38554)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Усть-Чарышская Пристань",operator:"",desc:""},{mask:"+7(38555)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Новичиха",operator:"",desc:""},{mask:"+7(38556)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Поспелиха",operator:"",desc:""},{mask:"+7(38557)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Рубцовск",operator:"",desc:""},{mask:"+7(38558)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Шелаболиха",operator:"",desc:""},{mask:"+7(38559)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Староалейское",operator:"",desc:""},{mask:"+7(38560)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Новоегорьевское",operator:"",desc:""},{mask:"+7(38561)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Романово",operator:"",desc:""},{mask:"+7(38562)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Завьялово",operator:"",desc:""},{mask:"+7(38563)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Родино",operator:"",desc:""},{mask:"+7(38564)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Благовещенка",operator:"",desc:""},{mask:"+7(38565)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Волчиха",operator:"",desc:""},{mask:"+7(38566)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Кулунда",operator:"",desc:""},{mask:"+7(38567)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Табуны",operator:"",desc:""},{mask:"+7(38568)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Славгород",operator:"",desc:""},{mask:"+7(38569)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Хабары",operator:"",desc:""},{mask:"+7(38570)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Михайловка",operator:"",desc:""},{mask:"+7(38571)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Быстрый Исток",operator:"",desc:""},{mask:"+7(38572)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Бурла",operator:"",desc:""},{mask:"+7(38573)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Петропавловское",operator:"",desc:""},{mask:"+7(38574)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Чарышское",operator:"",desc:""},{mask:"+7(38575)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Краснощеково",operator:"",desc:""},{mask:"+7(38576)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Курья",operator:"",desc:""},{mask:"+7(38577)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Белокуриха",operator:"",desc:""},{mask:"+7(38578)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Ключи",operator:"",desc:""},{mask:"+7(38579)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Угловское",operator:"",desc:""},{mask:"+7(38580)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Панкрушиха",operator:"",desc:""},{mask:"+7(38581)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Павловск",operator:"",desc:""},{mask:"+7(38582)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Ребриха",operator:"",desc:""},{mask:"+7(38583)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Мамонтово",operator:"",desc:""},{mask:"+7(38584)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Камень-на-Оби",operator:"",desc:""},{mask:"+7(38585)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Баево",operator:"",desc:""},{mask:"+7(38586)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Горняк",operator:"",desc:""},{mask:"+7(38587)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Змеиногорск",operator:"",desc:""},{mask:"+7(38588)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Тюменцево",operator:"",desc:""},{mask:"+7(38589)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Крутиха",operator:"",desc:""},{mask:"+7(38590)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Кытманово",operator:"",desc:""},{mask:"+7(38591)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Тальменка",operator:"",desc:""},{mask:"+7(38592)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Залесово",operator:"",desc:""},{mask:"+7(38593)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Ельцовка",operator:"",desc:""},{mask:"+7(38594)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Солонешное",operator:"",desc:""},{mask:"+7(38595)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Заринск",operator:"",desc:""},{mask:"+7(38596)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Целинное",operator:"",desc:""},{mask:"+7(38597)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Тогул",operator:"",desc:""},{mask:"+7(38598)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Советское",operator:"",desc:""},{mask:"+7(38599)#-##-##",cc:"RU",cd:"Russia",region:"Алтайский край",city:"Усть-Калманка",operator:"",desc:""},{mask:"+7(388)###-##-##",cc:"RU",cd:"Russia",region:"Республика Алтай",city:"",operator:"",desc:""},{mask:"+7(3882)##-##-##",cc:"RU",cd:"Russia",region:"Республика Алтай",city:"Горно-Алтайск",operator:"",desc:""},{mask:"+7(38840)#-##-##",cc:"RU",cd:"Russia",region:"Республика Алтай",city:"Чоя",operator:"",desc:""},{mask:"+7(38841)#-##-##",cc:"RU",cd:"Russia",region:"Республика Алтай",city:"Чемал",operator:"",desc:""},{mask:"+7(38842)#-##-##",cc:"RU",cd:"Russia",region:"Республика Алтай",city:"Кош-Агач",operator:"",desc:""},{mask:"+7(38843)#-##-##",cc:"RU",cd:"Russia",region:"Республика Алтай",city:"Турочак",operator:"",desc:""},{mask:"+7(38844)#-##-##",cc:"RU",cd:"Russia",region:"Республика Алтай",city:"Майма",operator:"",desc:""},{mask:"+7(38845)#-##-##",cc:"RU",cd:"Russia",region:"Республика Алтай",city:"Онгудай",operator:"",desc:""},{mask:"+7(38846)#-##-##",cc:"RU",cd:"Russia",region:"Республика Алтай",city:"Акташ",operator:"",desc:""},{mask:"+7(38847)#-##-##",cc:"RU",cd:"Russia",region:"Республика Алтай",city:"Усть-Кан",operator:"",desc:""},{mask:"+7(38848)#-##-##",cc:"RU",cd:"Russia",region:"Республика Алтай",city:"Усть-Кокса",operator:"",desc:""},{mask:"+7(38849)#-##-##",cc:"RU",cd:"Russia",region:"Республика Алтай",city:"Шебалино",operator:"",desc:""},{mask:"+7(390)###-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"",operator:"",desc:""},{mask:"+7(3902)##-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Абакан",operator:"",desc:""},{mask:"+7(39031)#-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Черногорск",operator:"",desc:""},{mask:"+7(39032)#-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Усть-Абакан",operator:"",desc:""},{mask:"+7(39033)#-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Сорск",operator:"",desc:""},{mask:"+7(39034)#-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Боград",operator:"",desc:""},{mask:"+7(39035)#-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Шира",operator:"",desc:""},{mask:"+7(39036)#-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Копьёво",operator:"",desc:""},{mask:"+7(39041)#-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Белый Яр",operator:"",desc:""},{mask:"+7(39042)#-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Саяногорск",operator:"",desc:""},{mask:"+7(39044)#-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Бея",operator:"",desc:""},{mask:"+7(39045)#-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Аскиз",operator:"",desc:""},{mask:"+7(39046)#-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Таштып",operator:"",desc:""},{mask:"+7(39047)#-##-##",cc:"RU",cd:"Russia",region:"Хакасия",city:"Абаза",operator:"",desc:""},{mask:"+7(391)###-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"",operator:"",desc:""},{mask:"+7(391)2##-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Красноярск",operator:"",desc:""},{mask:"+7(39131)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Сосновоборск",operator:"",desc:""},{mask:"+7(39132)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Минусинск",operator:"",desc:""},{mask:"+7(39133)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Емельяново",operator:"",desc:""},{mask:"+7(39134)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Краснотуранск",operator:"",desc:""},{mask:"+7(39135)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Идринское",operator:"",desc:""},{mask:"+7(39136)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Курагино",operator:"",desc:""},{mask:"+7(39137)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Каратузское",operator:"",desc:""},{mask:"+7(39138)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Ермаковское",operator:"",desc:""},{mask:"+7(39139)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Шушенское",operator:"",desc:""},{mask:"+7(39140)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Партизанское",operator:"",desc:""},{mask:"+7(39141)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Мотыгино",operator:"",desc:""},{mask:"+7(39142)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Агинское",operator:"",desc:""},{mask:"+7(39143)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Кодинск",operator:"",desc:""},{mask:"+7(39144)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Дивногорск",operator:"",desc:""},{mask:"+7(39145)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Лесосибирск",operator:"",desc:""},{mask:"+7(39146)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Уяр",operator:"",desc:""},{mask:"+7(39147)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Новоселово",operator:"",desc:""},{mask:"+7(39148)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Балахта",operator:"",desc:""},{mask:"+7(39149)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Шалинское",operator:"",desc:""},{mask:"+7(39150)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Новобирилюссы",operator:"",desc:""},{mask:"+7(39151)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Ачинск",operator:"",desc:""},{mask:"+7(39152)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Диксон",operator:"",desc:""},{mask:"+7(39153)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Шарыпово",operator:"",desc:""},{mask:"+7(39154)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Козулька",operator:"",desc:""},{mask:"+7(39155)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Назарово",operator:"",desc:""},{mask:"+7(39156)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Ужур",operator:"",desc:""},{mask:"+7(39157)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Боготол",operator:"",desc:""},{mask:"+7(39158)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Тюхтет",operator:"",desc:""},{mask:"+7(39159)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Большой Улуй",operator:"",desc:""},{mask:"+7(39160)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Северо-Енисейский",operator:"",desc:""},{mask:"+7(39161)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Канск",operator:"",desc:""},{mask:"+7(39162)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Богучаны",operator:"",desc:""},{mask:"+7(39163)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Абан",operator:"",desc:""},{mask:"+7(39164)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Тасеево",operator:"",desc:""},{mask:"+7(39165)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Заозерный",operator:"",desc:""},{mask:"+7(39166)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Пировское",operator:"",desc:""},{mask:"+7(39167)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Дзержинское",operator:"",desc:""},{mask:"+7(39168)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Бородино",operator:"",desc:""},{mask:"+7(39169)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Зеленогорск",operator:"",desc:""},{mask:"+7(39170)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Тура",operator:"",desc:""},{mask:"+7(39171)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Нижний Ингаш",operator:"",desc:""},{mask:"+7(39172)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Игарка",operator:"",desc:""},{mask:"+7(39173)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Иланский",operator:"",desc:""},{mask:"+7(39174)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Ирбейское",operator:"",desc:""},{mask:"+7(39175)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Берёзовка",operator:"",desc:""},{mask:"+7(39176)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Хатанга",operator:"",desc:""},{mask:"+7(39177)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Ванавара",operator:"",desc:""},{mask:"+7(39178)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Байкит",operator:"",desc:""},{mask:"+7(39179)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Караул",operator:"",desc:""},{mask:"+7(3919)2#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Норильск",operator:"",desc:""},{mask:"+7(3919)4#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Норильск",operator:"",desc:""},{mask:"+7(39190)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Туруханск",operator:"",desc:""},{mask:"+7(39191)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Дудинка",operator:"",desc:""},{mask:"+7(39193)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Снежногорск",operator:"",desc:""},{mask:"+7(39195)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Енисейск",operator:"",desc:""},{mask:"+7(39196)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Казачинское",operator:"",desc:""},{mask:"+7(39197)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Железногорск",operator:"",desc:""},{mask:"+7(39198)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Большая Мурта",operator:"",desc:""},{mask:"+7(39199)#-##-##",cc:"RU",cd:"Russia",region:"Красноярский край",city:"Сухобузимское",operator:"",desc:""},{mask:"+7(394)###-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"",operator:"",desc:""},{mask:"+7(3942)##-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Кызыл",operator:"",desc:""},{mask:"+7(39432)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Сарыг-Сеп",operator:"",desc:""},{mask:"+7(39433)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Ак-Довурак",operator:"",desc:""},{mask:"+7(39434)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Чадан",operator:"",desc:""},{mask:"+7(39435)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Туран",operator:"",desc:""},{mask:"+7(39436)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Шагонар",operator:"",desc:""},{mask:"+7(39437)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Бай-Хаак",operator:"",desc:""},{mask:"+7(39438)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Самагалтай",operator:"",desc:""},{mask:"+7(39439)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Эрзин",operator:"",desc:""},{mask:"+7(39441)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Кызыл-Мажалык",operator:"",desc:""},{mask:"+7(39442)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Тээли",operator:"",desc:""},{mask:"+7(39444)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Хандагайты",operator:"",desc:""},{mask:"+7(39445)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Суг-Аксы",operator:"",desc:""},{mask:"+7(39450)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Тоора-Хем",operator:"",desc:""},{mask:"+7(39451)#-##-##",cc:"RU",cd:"Russia",region:"Республика Тыва",city:"Мугур-Аксы",operator:"",desc:""},{mask:"+7(395)###-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"",operator:"",desc:""},{mask:"+7(3952)##-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Иркутск",operator:"",desc:""},{mask:"+7(3953)##-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Братск",operator:"",desc:""},{mask:"+7(39530)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Тулун",operator:"",desc:""},{mask:"+7(39535)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Усть-Илимск",operator:"",desc:""},{mask:"+7(39536)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Куйтун",operator:"",desc:""},{mask:"+7(39537)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Баяндай",operator:"",desc:""},{mask:"+7(39538)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Бохан",operator:"",desc:""},{mask:"+7(39539)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Оса",operator:"",desc:""},{mask:"+7(39540)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Качуг",operator:"",desc:""},{mask:"+7(39541)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Усть-Ордынский",operator:"",desc:""},{mask:"+7(39542)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Байкальск",operator:"",desc:""},{mask:"+7(39543)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Усолье-Сибирское",operator:"",desc:""},{mask:"+7(39544)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Слюдянка",operator:"",desc:""},{mask:"+7(39545)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Усть-Уда",operator:"",desc:""},{mask:"+7(39546)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Черемхово",operator:"",desc:""},{mask:"+7(39548)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Балаганск",operator:"",desc:""},{mask:"+7(39549)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Новонукутский",operator:"",desc:""},{mask:"+7(3955)##-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Ангарск",operator:"",desc:""},{mask:"+7(39550)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Шелехов",operator:"",desc:""},{mask:"+7(39551)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Жигалово",operator:"",desc:""},{mask:"+7(39552)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Залари",operator:"",desc:""},{mask:"+7(39553)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Саянск",operator:"",desc:""},{mask:"+7(39554)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Зима",operator:"",desc:""},{mask:"+7(39557)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Нижнеудинск",operator:"",desc:""},{mask:"+7(39558)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Ольхонск",operator:"",desc:""},{mask:"+7(39559)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Еланцы",operator:"",desc:""},{mask:"+7(39560)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Ербогачен",operator:"",desc:""},{mask:"+7(39561)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Бодайбо",operator:"",desc:""},{mask:"+7(39562)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Казачинское",operator:"",desc:""},{mask:"+7(39563)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Тайшет",operator:"",desc:""},{mask:"+7(39564)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Кутулик",operator:"",desc:""},{mask:"+7(39565)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Усть-Кут",operator:"",desc:""},{mask:"+7(39566)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Железногорск-Илимский",operator:"",desc:""},{mask:"+7(39567)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Чунский",operator:"",desc:""},{mask:"+7(39568)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Киренск",operator:"",desc:""},{mask:"+7(39569)#-##-##",cc:"RU",cd:"Russia",region:"Иркутская область",city:"Мама",operator:"",desc:""},{mask:"+7(401)###-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"",operator:"",desc:""},{mask:"+7(4012)##-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Калининград",operator:"",desc:""},{mask:"+7(40141)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Черняховск",operator:"",desc:""},{mask:"+7(40142)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Озёрск",operator:"",desc:""},{mask:"+7(40143)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Гусев",operator:"",desc:""},{mask:"+7(40144)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Нестеров",operator:"",desc:""},{mask:"+7(40145)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Балтийск",operator:"",desc:""},{mask:"+7(40150)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Зеленоградск",operator:"",desc:""},{mask:"+7(40151)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Гурьевск",operator:"",desc:""},{mask:"+7(40152)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Светлый",operator:"",desc:""},{mask:"+7(40153)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Светлогорск",operator:"",desc:""},{mask:"+7(40155)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Пионерский",operator:"",desc:""},{mask:"+7(40156)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Багратионовск",operator:"",desc:""},{mask:"+7(40157)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Правдинск",operator:"",desc:""},{mask:"+7(40158)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Полесск",operator:"",desc:""},{mask:"+7(40159)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Гвардейск",operator:"",desc:""},{mask:"+7(40161)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Советск",operator:"",desc:""},{mask:"+7(40162)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Неман",operator:"",desc:""},{mask:"+7(40163)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Славск",operator:"",desc:""},{mask:"+7(40164)#-##-##",cc:"RU",cd:"Russia",region:"Калининградская область",city:"Краснознаменск",operator:"",desc:""},{mask:"+7(411)###-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"",operator:"",desc:""},{mask:"+7(4112)##-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Якутск",operator:"",desc:""},{mask:"+7(41131)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Бердигестях",operator:"",desc:""},{mask:"+7(41132)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Вилюйск",operator:"",desc:""},{mask:"+7(41133)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Верхневилюйск",operator:"",desc:""},{mask:"+7(41134)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Нюрба",operator:"",desc:""},{mask:"+7(41135)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Сунтар",operator:"",desc:""},{mask:"+7(41136)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Мирный",operator:"",desc:""},{mask:"+7(41137)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Ленск",operator:"",desc:""},{mask:"+7(41138)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Олёкминск",operator:"",desc:""},{mask:"+7(41140)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Солнечный",operator:"",desc:""},{mask:"+7(41141)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Усть-Мая",operator:"",desc:""},{mask:"+7(41142)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Амга",operator:"",desc:""},{mask:"+7(41143)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Майя",operator:"",desc:""},{mask:"+7(41144)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Покровск",operator:"",desc:""},{mask:"+7(41145)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Алдан",operator:"",desc:""},{mask:"+7(41147)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Нерюнгри",operator:"",desc:""},{mask:"+7(41150)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Хонуу",operator:"",desc:""},{mask:"+7(41151)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Чурапча",operator:"",desc:""},{mask:"+7(41152)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Ытык-Кюёль",operator:"",desc:""},{mask:"+7(41153)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Хандыга",operator:"",desc:""},{mask:"+7(41154)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Усть-Нера",operator:"",desc:""},{mask:"+7(41155)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Зырянка",operator:"",desc:""},{mask:"+7(41156)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Среднеколымск",operator:"",desc:""},{mask:"+7(41157)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Черский",operator:"",desc:""},{mask:"+7(41158)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Чокурдах",operator:"",desc:""},{mask:"+7(41159)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Белая Гора",operator:"",desc:""},{mask:"+7(41160)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Батагай-Алыта",operator:"",desc:""},{mask:"+7(41161)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Борогонцы",operator:"",desc:""},{mask:"+7(41162)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Намцы",operator:"",desc:""},{mask:"+7(41163)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Сангар",operator:"",desc:""},{mask:"+7(41164)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Жиганск",operator:"",desc:""},{mask:"+7(41165)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Батагай",operator:"",desc:""},{mask:"+7(41166)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Депутатский",operator:"",desc:""},{mask:"+7(41167)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Тикси",operator:"",desc:""},{mask:"+7(41168)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Саскылах",operator:"",desc:""},{mask:"+7(41169)#-##-##",cc:"RU",cd:"Russia",region:"Якутия",city:"Оленёк",operator:"",desc:""},{mask:"+7(413)###-##-##",cc:"RU",cd:"Russia",region:"Магаданская область",city:"",operator:"",desc:""},{mask:"+7(4132)##-##-##",cc:"RU",cd:"Russia",region:"Магаданская область",city:"Магадан",operator:"",desc:""},{mask:"+7(41341)#-##-##",cc:"RU",cd:"Russia",region:"Магаданская область",city:"Ола",operator:"",desc:""},{mask:"+7(41342)#-##-##",cc:"RU",cd:"Russia",region:"Магаданская область",city:"Палатка",operator:"",desc:""},{mask:"+7(41343)#-##-##",cc:"RU",cd:"Russia",region:"Магаданская область",city:"Ягодное",operator:"",desc:""},{mask:"+7(41344)#-##-##",cc:"RU",cd:"Russia",region:"Магаданская область",city:"Усть-Омчуг",operator:"",desc:""},{mask:"+7(41345)#-##-##",cc:"RU",cd:"Russia",region:"Магаданская область",city:"Сусуман",operator:"",desc:""},{mask:"+7(41346)#-##-##",cc:"RU",cd:"Russia",region:"Магаданская область",city:"Омсукчан",operator:"",desc:""},{mask:"+7(41347)#-##-##",cc:"RU",cd:"Russia",region:"Магаданская область",city:"Сеймчан",operator:"",desc:""},{mask:"+7(41348)#-##-##",cc:"RU",cd:"Russia",region:"Магаданская область",city:"Эвенск",operator:"",desc:""},{mask:"+7(415)###-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"",operator:"",desc:""},{mask:"+7(4152)##-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Петропавловск-Камчатский",operator:"",desc:""},{mask:"+7(41531)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Елизово",operator:"",desc:""},{mask:"+7(41532)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Усть-Большерецк",operator:"",desc:""},{mask:"+7(41533)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Мильково",operator:"",desc:""},{mask:"+7(41534)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Усть-Камчатск",operator:"",desc:""},{mask:"+7(41535)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Вилючинск",operator:"",desc:""},{mask:"+7(41536)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Соболево",operator:"",desc:""},{mask:"+7(41537)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Тигиль",operator:"",desc:""},{mask:"+7(41538)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Вилючинск-3",operator:"",desc:""},{mask:"+7(41539)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Усть-Хайрюзово",operator:"",desc:""},{mask:"+7(41541)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Ключи",operator:"",desc:""},{mask:"+7(41542)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Эссо",operator:"",desc:""},{mask:"+7(41543)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Палана",operator:"",desc:""},{mask:"+7(41544)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Тиличики",operator:"",desc:""},{mask:"+7(41545)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Оссора",operator:"",desc:""},{mask:"+7(41546)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Каменское",operator:"",desc:""},{mask:"+7(41547)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Никольское",operator:"",desc:""},{mask:"+7(41548)#-##-##",cc:"RU",cd:"Russia",region:"Камчатский край",city:"Козыревск",operator:"",desc:""},{mask:"+7(416)###-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"",operator:"",desc:""},{mask:"+7(4162)##-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:["Благовещенск","Благовещенский район"],operator:"",desc:""},{mask:"+7(41631)2-0#-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Ивановский район",operator:"Транссвязьтелеком",desc:""},{mask:"+7(41632)3-0#-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Октябрьский район",operator:"Транссвязьтелеком",desc:""},{mask:"+7(41633)3-0#-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Райчихинск",operator:"Транссвязьтелеком",desc:""},{mask:"+7(41634)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Бурейский район",operator:"",desc:""},{mask:"+7(41637)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Михайловский район",operator:"",desc:""},{mask:"+7(41638)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Тамбовский район",operator:"",desc:""},{mask:"+7(41639)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Константиновский район",operator:"",desc:""},{mask:"+7(41641)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Белогорский район",operator:"",desc:""},{mask:"+7(41642)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Серышевский район",operator:"",desc:""},{mask:"+7(41643)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Свободненский район",operator:"",desc:""},{mask:"+7(41644)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Мазановский район",operator:"",desc:""},{mask:"+7(41645)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Ромненский район",operator:"",desc:""},{mask:"+7(41646)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Селемджинский район",operator:"",desc:""},{mask:"+7(41647)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Райчихинск",operator:"",desc:""},{mask:"+7(41648)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Архаринский район",operator:"",desc:""},{mask:"+7(41649)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Ивановский район",operator:"",desc:""},{mask:"+7(41651)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Шимановский район",operator:"",desc:""},{mask:"+7(41652)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Октябрьский район",operator:"",desc:""},{mask:"+7(41653)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Магдагачинский район",operator:"",desc:""},{mask:"+7(41654)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Сковородинский район",operator:"",desc:""},{mask:"+7(41655)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Селемджинский район",operator:"",desc:""},{mask:"+7(41656)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Тындинский район",operator:"",desc:""},{mask:"+7(41658)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Зейский район",operator:"",desc:""},{mask:"+7(421)###-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"",operator:"",desc:""},{mask:"+7(4212)##-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Хабаровск",operator:"",desc:""},{mask:"+7(42135)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Николаевск-на-Амуре",operator:"",desc:""},{mask:"+7(41636)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Завитинский район",operator:"",desc:""},{mask:"+7(41636)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Завитинский район",operator:"",desc:""},{mask:"+7(41636)#-##-##",cc:"RU",cd:"Russia",region:"Амурская область",city:"Завитинский район",operator:"",desc:""},{mask:"+7(42137)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Ванино",operator:"",desc:""},{mask:"+7(42138)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Советская Гавань",operator:"",desc:""},{mask:"+7(42141)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Охотск",operator:"",desc:""},{mask:"+7(42142)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Амурск",operator:"",desc:""},{mask:"+7(42143)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Чумикан",operator:"",desc:""},{mask:"+7(42144)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"им. Полины Осипенко",operator:"",desc:""},{mask:"+7(42146)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Солнечный",operator:"",desc:""},{mask:"+7(42147)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Аян",operator:"",desc:""},{mask:"+7(42149)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Чегдомын",operator:"",desc:""},{mask:"+7(42151)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Богородское",operator:"",desc:""},{mask:"+7(42153)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Вяземский",operator:"",desc:""},{mask:"+7(42154)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Переяславка",operator:"",desc:""},{mask:"+7(42155)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Бикин",operator:"",desc:""},{mask:"+7(42156)#-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Троицкое",operator:"",desc:""},{mask:"+7(4217)##-##-##",cc:"RU",cd:"Russia",region:"Хабаровский край",city:"Комсомольск-на-Амуре",operator:"",desc:""},{mask:"+7(423)###-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Владивосток",operator:"",desc:""},{mask:"+7(42331)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Славянка",operator:"",desc:""},{mask:"+7(42334)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:["Вольно-Надеждинское","Раздольное"],operator:"",desc:""},{mask:"+7(42335)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Большой Камень",operator:"",desc:""},{mask:"+7(42337)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Артем",operator:"",desc:""},{mask:"+7(42339)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Фокино",operator:"",desc:""},{mask:"+7(4234)##-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Уссурийск",operator:"",desc:""},{mask:"+7(42344)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Покровка",operator:"",desc:""},{mask:"+7(42345)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Пограничный",operator:"",desc:""},{mask:"+7(42346)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Михайловка",operator:"",desc:""},{mask:"+7(42347)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Хороль",operator:"",desc:""},{mask:"+7(42349)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Камень-Рыболов",operator:"",desc:""},{mask:"+7(42351)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Черниговка",operator:"",desc:""},{mask:"+7(42352)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Спасск-Дальний",operator:"",desc:""},{mask:"+7(42354)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Кировский",operator:"",desc:""},{mask:"+7(42355)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Лесозаводск",operator:"",desc:""},{mask:"+7(42356)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Дальнереченск",operator:"",desc:""},{mask:"+7(42357)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Лучегорск",operator:"",desc:""},{mask:"+7(42359)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Новопокровка",operator:"",desc:""},{mask:"+7(4236)##-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:["Находка","Порт Восточный"],operator:"",desc:""},{mask:"+7(42361)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Арсеньев",operator:"",desc:""},{mask:"+7(42362)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Анучино",operator:"",desc:""},{mask:"+7(42363)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Партизанск",operator:"",desc:""},{mask:"+7(42365)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Владимиро-Александровское",operator:"",desc:""},{mask:"+7(42371)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Яковлевка",operator:"",desc:""},{mask:"+7(42372)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Чугуевка",operator:"",desc:""},{mask:"+7(42373)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Дальнегорск",operator:"",desc:""},{mask:"+7(42374)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Терней",operator:"",desc:""},{mask:"+7(42375)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Кавалерово",operator:"",desc:""},{mask:"+7(42376)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Ольга",operator:"",desc:""},{mask:"+7(42377)#-##-##",cc:"RU",cd:"Russia",region:"Приморский край",city:"Лазо",operator:"",desc:""},{mask:"+7(424)###-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"",operator:"",desc:""},{mask:"+7(4242)##-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Южно-Сахалинск",operator:"",desc:""},{mask:"+7(42431)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Поронайск",operator:"",desc:""},{mask:"+7(42432)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Углегорск",operator:"",desc:""},{mask:"+7(42433)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Холмск",operator:"",desc:""},{mask:"+7(42434)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Александровск-Сахалинский",operator:"",desc:""},{mask:"+7(42435)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Корсаков",operator:"",desc:""},{mask:"+7(42436)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Невельск",operator:"",desc:""},{mask:"+7(42437)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Оха",operator:"",desc:""},{mask:"+7(42441)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Анива",operator:"",desc:""},{mask:"+7(42442)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Долинск",operator:"",desc:""},{mask:"+7(42443)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Макаров",operator:"",desc:""},{mask:"+7(42444)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Ноглики",operator:"",desc:""},{mask:"+7(42446)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Томари",operator:"",desc:""},{mask:"+7(42447)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Тымовское",operator:"",desc:""},{mask:"+7(42452)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Смирных",operator:"",desc:""},{mask:"+7(42453)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Северо-Курильск",operator:"",desc:""},{mask:"+7(42454)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Курильск",operator:"",desc:""},{mask:"+7(42455)#-##-##",cc:"RU",cd:"Russia",region:"Сахалинская область",city:"Южно-Курильск",operator:"",desc:""},{mask:"+7(426)###-##-##",cc:"RU",cd:"Russia",region:"Еврейская автономная область",city:"",operator:"",desc:""},{mask:"+7(42622)#-##-##",cc:"RU",cd:"Russia",region:"Еврейская автономная область",city:"Биробиджан",operator:"",desc:""},{mask:"+7(42632)#-##-##",cc:"RU",cd:"Russia",region:"Еврейская автономная область",city:"Смидович",operator:"",desc:""},{mask:"+7(42663)#-##-##",cc:"RU",cd:"Russia",region:"Еврейская автономная область",city:"Ленинское",operator:"",desc:""},{mask:"+7(42665)#-##-##",cc:"RU",cd:"Russia",region:"Еврейская автономная область",city:"Амурзет",operator:"",desc:""},{mask:"+7(42666)#-##-##",cc:"RU",cd:"Russia",region:"Еврейская автономная область",city:"Облучье",operator:"",desc:""},{mask:"+7(427)###-##-##",cc:"RU",cd:"Russia",region:"Чукотский автономный округ",city:"",operator:"",desc:""},{mask:"+7(42722)#-##-##",cc:"RU",cd:"Russia",region:"Чукотский автономный округ",city:"Анадырь",operator:"",desc:""},{mask:"+7(42732)#-##-##",cc:"RU",cd:"Russia",region:"Чукотский автономный округ",city:"Угольные Копи",operator:"",desc:""},{mask:"+7(42733)#-##-##",cc:"RU",cd:"Russia",region:"Чукотский автономный округ",city:"Беринговский",operator:"",desc:""},{mask:"+7(42734)#-##-##",cc:"RU",cd:"Russia",region:"Чукотский автономный округ",city:"Эгвекинот",operator:"",desc:""},{mask:"+7(42735)#-##-##",cc:"RU",cd:"Russia",region:"Чукотский автономный округ",city:"Провидения",operator:"",desc:""},{mask:"+7(42736)#-##-##",cc:"RU",cd:"Russia",region:"Чукотский автономный округ",city:"Лаврентия",operator:"",desc:""},{mask:"+7(42737)#-##-##",cc:"RU",cd:"Russia",region:"Чукотский автономный округ",city:"Певек",operator:"",desc:""},{mask:"+7(42738)#-##-##",cc:"RU",cd:"Russia",region:"Чукотский автономный округ",city:"Билибино",operator:"",desc:""},{mask:"+7(42739)#-##-##",cc:"RU",cd:"Russia",region:"Чукотский автономный округ",city:"Мыс Шмидта",operator:"",desc:""},{mask:"+7(471)###-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"",operator:"",desc:""},{mask:"+7(4712)##-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Курск",operator:"",desc:""},{mask:"+7(47131)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Курчатов",operator:"",desc:""},{mask:"+7(47132)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Глушково",operator:"",desc:""},{mask:"+7(47133)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Горшечное",operator:"",desc:""},{mask:"+7(47134)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Пристень",operator:"",desc:""},{mask:"+7(47135)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Поныри",operator:"",desc:""},{mask:"+7(47136)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Большое Солдатское",operator:"",desc:""},{mask:"+7(47137)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Хомутовка",operator:"",desc:""},{mask:"+7(47140)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Льгов",operator:"",desc:""},{mask:"+7(47141)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Обоянь",operator:"",desc:""},{mask:"+7(47142)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Прямицыно",operator:"",desc:""},{mask:"+7(47143)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Суджа",operator:"",desc:""},{mask:"+7(47144)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Фатеж",operator:"",desc:""},{mask:"+7(47145)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Щигры",operator:"",desc:""},{mask:"+7(47146)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Медвенка",operator:"",desc:""},{mask:"+7(47147)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Коренево",operator:"",desc:""},{mask:"+7(47148)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Железногорск",operator:"",desc:""},{mask:"+7(47149)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Белая",operator:"",desc:""},{mask:"+7(47150)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Дмитриев-Льговский",operator:"",desc:""},{mask:"+7(47151)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Золотухино",operator:"",desc:""},{mask:"+7(47152)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Рыльск",operator:"",desc:""},{mask:"+7(47153)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Тим",operator:"",desc:""},{mask:"+7(47154)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Солнцево",operator:"",desc:""},{mask:"+7(47155)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Мантурово",operator:"",desc:""},{mask:"+7(47156)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Конышевка",operator:"",desc:""},{mask:"+7(47157)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Касторное",operator:"",desc:""},{mask:"+7(47158)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Кшенский",operator:"",desc:""},{mask:"+7(47159)#-##-##",cc:"RU",cd:"Russia",region:"Курская область",city:"Черемисиново",operator:"",desc:""},{mask:"+7(472)###-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"",operator:"",desc:""},{mask:"+7(4722)##-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Белгород",operator:"",desc:""},{mask:"+7(47231)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Короча",operator:"",desc:""},{mask:"+7(47232)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Чернянка",operator:"",desc:""},{mask:"+7(47233)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Новый Оскол",operator:"",desc:""},{mask:"+7(47234)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Алексеевка",operator:"",desc:""},{mask:"+7(47235)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Волоконовка",operator:"",desc:""},{mask:"+7(47236)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Валуйки",operator:"",desc:""},{mask:"+7(47237)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Вейделевка",operator:"",desc:""},{mask:"+7(47238)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Ровеньки",operator:"",desc:""},{mask:"+7(47241)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Губкин",operator:"",desc:""},{mask:"+7(47242)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Прохоровка",operator:"",desc:""},{mask:"+7(47243)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Ивня",operator:"",desc:""},{mask:"+7(47244)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Строитель",operator:"",desc:""},{mask:"+7(47245)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Ракитное",operator:"",desc:""},{mask:"+7(47246)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Борисовка",operator:"",desc:""},{mask:"+7(47247)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Красногвардейское",operator:"",desc:""},{mask:"+7(47248)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Шебекино",operator:"",desc:""},{mask:"+7(4725)##-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Старый Оскол",operator:"",desc:""},{mask:"+7(47261)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Грайворон",operator:"",desc:""},{mask:"+7(47262)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Красное",operator:"",desc:""},{mask:"+7(47263)#-##-##",cc:"RU",cd:"Russia",region:"Белгородская область",city:"Красная Яруга",operator:"",desc:""},{mask:"+7(473)###-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Воронеж",operator:"",desc:""},{mask:"+7(47340)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Рамонь",operator:"",desc:""},{mask:"+7(47341)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Новая Усмань",operator:"",desc:""},{mask:"+7(47342)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Каширское",operator:"",desc:""},{mask:"+7(47343)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Верхняя Хава",operator:"",desc:""},{mask:"+7(47344)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Панино",operator:"",desc:""},{mask:"+7(47345)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Эртиль",operator:"",desc:""},{mask:"+7(47346)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Анна",operator:"",desc:""},{mask:"+7(47347)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Терновка",operator:"",desc:""},{mask:"+7(47348)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Грибановский",operator:"",desc:""},{mask:"+7(47350)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Бобров",operator:"",desc:""},{mask:"+7(47352)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Таловая",operator:"",desc:""},{mask:"+7(47353)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Новохоперск",operator:"",desc:""},{mask:"+7(47354)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Борисоглебск",operator:"",desc:""},{mask:"+7(47355)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Верхний Мамон",operator:"",desc:""},{mask:"+7(47356)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Воробьёвка",operator:"",desc:""},{mask:"+7(47357)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Каменка",operator:"",desc:""},{mask:"+7(47361)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Бутурлиновка",operator:"",desc:""},{mask:"+7(47362)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Павловск",operator:"",desc:""},{mask:"+7(47363)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Калач",operator:"",desc:""},{mask:"+7(47364)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Нововоронеж",operator:"",desc:""},{mask:"+7(47365)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Петропавловка",operator:"",desc:""},{mask:"+7(47366)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Богучар",operator:"",desc:""},{mask:"+7(47367)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Кантемировка",operator:"",desc:""},{mask:"+7(47370)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Нижнедевицк",operator:"",desc:""},{mask:"+7(47371)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Хохольский",operator:"",desc:""},{mask:"+7(47372)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:["Семилуки","Семилукский район"],operator:"",desc:""},{mask:"+7(47374)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Репьевка",operator:"",desc:""},{mask:"+7(47375)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Острогожск",operator:"",desc:""},{mask:"+7(47376)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Поворино",operator:"",desc:""},{mask:"+7(47391)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Лиски",operator:"",desc:""},{mask:"+7(47394)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Подгоренский",operator:"",desc:""},{mask:"+7(47395)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Ольховатка",operator:"",desc:""},{mask:"+7(47396)#-##-##",cc:"RU",cd:"Russia",region:"Воронежская область",city:"Россошь",operator:"",desc:""},{mask:"+7(474)###-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"",operator:"",desc:""},{mask:"+7(4742)##-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Липецк",operator:"",desc:""},{mask:"+7(47461)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Грязи",operator:"",desc:""},{mask:"+7(47462)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Добринка",operator:"",desc:""},{mask:"+7(47463)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Доброе",operator:"",desc:""},{mask:"+7(47464)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Лев Толстой",operator:"",desc:""},{mask:"+7(47465)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Данков",operator:"",desc:""},{mask:"+7(47466)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Лебедянь",operator:"",desc:""},{mask:"+7(47467)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Елец",operator:"",desc:""},{mask:"+7(47468)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Долгоруково",operator:"",desc:""},{mask:"+7(47469)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Красное",operator:"",desc:""},{mask:"+7(47471)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Задонск",operator:"",desc:""},{mask:"+7(47472)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Усмань",operator:"",desc:""},{mask:"+7(47473)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Волово",operator:"",desc:""},{mask:"+7(47474)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Тербуны",operator:"",desc:""},{mask:"+7(47475)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Чаплыгин",operator:"",desc:""},{mask:"+7(47476)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Становое",operator:"",desc:""},{mask:"+7(47477)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Хлевное",operator:"",desc:""},{mask:"+7(47478)#-##-##",cc:"RU",cd:"Russia",region:"Липецкая область",city:"Измалково",operator:"",desc:""},{mask:"+7(475)###-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"",operator:"",desc:""},{mask:"+7(4752)##-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Тамбов",operator:"",desc:""},{mask:"+7(47531)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Рассказово",operator:"",desc:""},{mask:"+7(47532)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Сосновка",operator:"",desc:""},{mask:"+7(47533)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Моршанск",operator:"",desc:""},{mask:"+7(47534)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Бондари",operator:"",desc:""},{mask:"+7(47535)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Жердевка",operator:"",desc:""},{mask:"+7(47536)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Дмитриевка",operator:"",desc:""},{mask:"+7(47537)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Кирсанов",operator:"",desc:""},{mask:"+7(47541)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Котовск",operator:"",desc:""},{mask:"+7(47542)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Мордово",operator:"",desc:""},{mask:"+7(47543)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Староюрьево",operator:"",desc:""},{mask:"+7(47544)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Петровское",operator:"",desc:""},{mask:"+7(47545)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Мичуринск",operator:"",desc:""},{mask:"+7(47546)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Мучкапский",operator:"",desc:""},{mask:"+7(47548)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Первомайский",operator:"",desc:""},{mask:"+7(47551)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Гавриловка Вторая",operator:"",desc:""},{mask:"+7(47552)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Знаменка",operator:"",desc:""},{mask:"+7(47553)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Инжавино",operator:"",desc:""},{mask:"+7(47554)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Пичаево",operator:"",desc:""},{mask:"+7(47555)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Ржакса",operator:"",desc:""},{mask:"+7(47556)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Сатинка",operator:"",desc:""},{mask:"+7(47557)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Токарёвка",operator:"",desc:""},{mask:"+7(47558)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Уварово",operator:"",desc:""},{mask:"+7(47559)#-##-##",cc:"RU",cd:"Russia",region:"Тамбовская область",city:"Умёт",operator:"",desc:""},{mask:"+7(481)###-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"",operator:"",desc:""},{mask:"+7(4812)##-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Смоленск",operator:"",desc:""},{mask:"+7(48130)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Сычевка",operator:"",desc:""},{mask:"+7(48131)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Вязьма",operator:"",desc:""},{mask:"+7(48132)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Велиж",operator:"",desc:""},{mask:"+7(48133)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Шумячи",operator:"",desc:""},{mask:"+7(48134)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Рославль",operator:"",desc:""},{mask:"+7(48135)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Гагарин",operator:"",desc:""},{mask:"+7(48136)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Тёмкино",operator:"",desc:""},{mask:"+7(48137)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Угра",operator:"",desc:""},{mask:"+7(48138)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Новодугино",operator:"",desc:""},{mask:"+7(48139)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Холм-Жирковский",operator:"",desc:""},{mask:"+7(48140)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Хиславичи",operator:"",desc:""},{mask:"+7(48141)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Рудня",operator:"",desc:""},{mask:"+7(48142)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Сафоново",operator:"",desc:""},{mask:"+7(48143)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Ярцево",operator:"",desc:""},{mask:"+7(48144)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Дорогобуж",operator:"",desc:""},{mask:"+7(48145)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Красный",operator:"",desc:""},{mask:"+7(48146)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Ельня",operator:"",desc:""},{mask:"+7(48147)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Демидов",operator:"",desc:""},{mask:"+7(48148)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Монастырщина",operator:"",desc:""},{mask:"+7(48149)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Починок",operator:"",desc:""},{mask:"+7(48153)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Десногорск",operator:"",desc:""},{mask:"+7(48155)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Ершичи",operator:"",desc:""},{mask:"+7(48165)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Глинка",operator:"",desc:""},{mask:"+7(48166)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Духовщина",operator:"",desc:""},{mask:"+7(48167)#-##-##",cc:"RU",cd:"Russia",region:"Смоленская область",city:"Кардымово",operator:"",desc:""},{mask:"+7(482)###-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"",operator:"",desc:""},{mask:"+7(4822)##-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Тверь",operator:"",desc:""},{mask:"+7(48230)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Пено",operator:"",desc:""},{mask:"+7(48231)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Бежецк",operator:"",desc:""},{mask:"+7(48232)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Ржев",operator:"",desc:""},{mask:"+7(48233)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Вышний Волочек",operator:"",desc:""},{mask:"+7(48234)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Кашин",operator:"",desc:""},{mask:"+7(48235)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Осташков",operator:"",desc:""},{mask:"+7(48236)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Кимры",operator:"",desc:""},{mask:"+7(48237)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Красный Холм",operator:"",desc:""},{mask:"+7(48238)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Бологое",operator:"",desc:""},{mask:"+7(48239)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Фирово",operator:"",desc:""},{mask:"+7(48242)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Конаково",operator:"",desc:""},{mask:"+7(48244)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Рамешки",operator:"",desc:""},{mask:"+7(48246)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Сонково",operator:"",desc:""},{mask:"+7(48249)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Калязин",operator:"",desc:""},{mask:"+7(48250)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Белый",operator:"",desc:""},{mask:"+7(48251)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Торжок",operator:"",desc:""},{mask:"+7(48253)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Максатиха",operator:"",desc:""},{mask:"+7(48255)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Удомля",operator:"",desc:""},{mask:"+7(48257)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Кувшиново",operator:"",desc:""},{mask:"+7(48258)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Оленино",operator:"",desc:""},{mask:"+7(48261)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Лихославль",operator:"",desc:""},{mask:"+7(48262)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Зубцов",operator:"",desc:""},{mask:"+7(48263)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Старица",operator:"",desc:""},{mask:"+7(48264)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Весьегонск",operator:"",desc:""},{mask:"+7(48265)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Западная Двина",operator:"",desc:""},{mask:"+7(48266)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Нелидово",operator:"",desc:""},{mask:"+7(48267)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Андреаполь",operator:"",desc:""},{mask:"+7(48268)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Торопец",operator:"",desc:""},{mask:"+7(48269)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Селижарово",operator:"",desc:""},{mask:"+7(48271)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Лесное",operator:"",desc:""},{mask:"+7(48272)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Сандово",operator:"",desc:""},{mask:"+7(48273)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Жарковский",operator:"",desc:""},{mask:"+7(48274)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Кесова Гора",operator:"",desc:""},{mask:"+7(48275)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Молоково",operator:"",desc:""},{mask:"+7(48276)#-##-##",cc:"RU",cd:"Russia",region:"Тверская область",city:"Спирово",operator:"",desc:""},{mask:"+7(483)###-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"",operator:"",desc:""},{mask:"+7(4832)##-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:["Брянск","Сельцо","Белые Берега"],operator:"",desc:""},{mask:"+7(48330)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Сураж",operator:"",desc:""},{mask:"+7(48331)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Рогнедино",operator:"",desc:""},{mask:"+7(48332)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Дубровка",operator:"",desc:""},{mask:"+7(48333)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:["Дятьково","Фокино"],operator:"",desc:""},{mask:"+7(48334)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Жуковка",operator:"",desc:""},{mask:"+7(48335)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Карачев",operator:"",desc:""},{mask:"+7(48336)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Клинцы",operator:"",desc:""},{mask:"+7(48338)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Клетня",operator:"",desc:""},{mask:"+7(48339)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Мглин",operator:"",desc:""},{mask:"+7(48340)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Гордеевка",operator:"",desc:""},{mask:"+7(48341)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Выгоничи",operator:"",desc:""},{mask:"+7(48342)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Навля",operator:"",desc:""},{mask:"+7(48343)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Новозыбков",operator:"",desc:""},{mask:"+7(48344)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Жирятино",operator:"",desc:""},{mask:"+7(48345)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Почеп",operator:"",desc:""},{mask:"+7(48346)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Красная Гора",operator:"",desc:""},{mask:"+7(48347)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Климово",operator:"",desc:""},{mask:"+7(48348)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Стародуб",operator:"",desc:""},{mask:"+7(48349)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Погар",operator:"",desc:""},{mask:"+7(48351)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Унеча",operator:"",desc:""},{mask:"+7(48352)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Трубчевск",operator:"",desc:""},{mask:"+7(48353)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Суземка",operator:"",desc:""},{mask:"+7(48354)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Локоть",operator:"",desc:""},{mask:"+7(48355)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Комаричи",operator:"",desc:""},{mask:"+7(48356)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Севск",operator:"",desc:""},{mask:"+7(48358)#-##-##",cc:"RU",cd:"Russia",region:"Брянская область",city:"Злынка",operator:"",desc:""},{mask:"+7(484)###-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"",operator:"",desc:""},{mask:"+7(4842)##-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Калуга",operator:"",desc:""},{mask:"+7(48431)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Малоярославец",operator:"",desc:""},{mask:"+7(48432)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Жуков",operator:"",desc:""},{mask:"+7(48433)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Медынь",operator:"",desc:""},{mask:"+7(48434)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Кондрово",operator:"",desc:""},{mask:"+7(48435)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Таруса",operator:"",desc:""},{mask:"+7(48436)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Юхнов",operator:"",desc:""},{mask:"+7(48437)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Ферзиково",operator:"",desc:""},{mask:"+7(48438)2-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Балабаново",operator:"",desc:""},{mask:"+7(48438)4-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Боровск",operator:"",desc:""},{mask:"+7(48438)6-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Балабаново",operator:"",desc:""},{mask:"+7(48439)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Обнинск",operator:"",desc:""},{mask:"+7(48441)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Перемышль",operator:"",desc:""},{mask:"+7(48442)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Козельск",operator:"",desc:""},{mask:"+7(48443)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Ульяново",operator:"",desc:""},{mask:"+7(48444)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Людиново",operator:"",desc:""},{mask:"+7(48445)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Жиздра",operator:"",desc:""},{mask:"+7(48446)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Мещовск",operator:"",desc:""},{mask:"+7(48447)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Думиничи",operator:"",desc:""},{mask:"+7(48448)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Бабынино",operator:"",desc:""},{mask:"+7(48449)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Износки",operator:"",desc:""},{mask:"+7(48451)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Сухиничи",operator:"",desc:""},{mask:"+7(48452)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Мосальск",operator:"",desc:""},{mask:"+7(48453)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Хвастовичи",operator:"",desc:""},{mask:"+7(48454)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Барятино",operator:"",desc:""},{mask:"+7(48455)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Спас-Деменск",operator:"",desc:""},{mask:"+7(48456)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Киров",operator:"",desc:""},{mask:"+7(48457)#-##-##",cc:"RU",cd:"Russia",region:"Калужская область",city:"Бетлица",operator:"",desc:""},{mask:"+7(485)###-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"",operator:"",desc:""},{mask:"+7(4852)##-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Ярославль",operator:"",desc:""},{mask:"+7(48531)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Некрасовское",operator:"",desc:""},{mask:"+7(48532)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Углич",operator:"",desc:""},{mask:"+7(48533)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Тутаев",operator:"",desc:""},{mask:"+7(48534)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Гаврилов Ям",operator:"",desc:""},{mask:"+7(48535)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Переславль-Залесский",operator:"",desc:""},{mask:"+7(48536)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Ростов",operator:"",desc:""},{mask:"+7(48538)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Данилов",operator:"",desc:""},{mask:"+7(48539)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Борисоглебский",operator:"",desc:""},{mask:"+7(48542)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Большое Село",operator:"",desc:""},{mask:"+7(48543)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Любим",operator:"",desc:""},{mask:"+7(48544)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Мышкин",operator:"",desc:""},{mask:"+7(48545)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Брейтово",operator:"",desc:""},{mask:"+7(48546)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Пошехонье",operator:"",desc:""},{mask:"+7(48547)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Новый Некоуз",operator:"",desc:""},{mask:"+7(48549)#-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Пречистое",operator:"",desc:""},{mask:"+7(4855)##-##-##",cc:"RU",cd:"Russia",region:"Ярославская область",city:"Рыбинск",operator:"",desc:""},{mask:"+7(486)###-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"",operator:"",desc:""},{mask:"+7(4862)##-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:["Орёл","Орловский район"],operator:"",desc:""},{mask:"+7(48640)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Болхов",operator:"",desc:""},{mask:"+7(48642)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Хотынец",operator:"",desc:""},{mask:"+7(48643)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Кромы",operator:"",desc:""},{mask:"+7(48644)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Шаблыкино",operator:"",desc:""},{mask:"+7(48645)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Змиевка",operator:"",desc:""},{mask:"+7(48646)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Мценск",operator:"",desc:""},{mask:"+7(48647)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Нарышкино",operator:"",desc:""},{mask:"+7(48648)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Залегощь",operator:"",desc:""},{mask:"+7(48649)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Дмитровск",operator:"",desc:""},{mask:"+7(48661)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"",operator:"МТС",desc:"мобильные телефоны с зоновыми номерами"},{mask:"+7(48662)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Знаменское",operator:"",desc:""},{mask:"+7(48663)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Красная Заря",operator:"",desc:""},{mask:"+7(48664)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Покровское",operator:"",desc:""},{mask:"+7(48665)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Сосково",operator:"",desc:""},{mask:"+7(48666)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Тросна",operator:"",desc:""},{mask:"+7(48667)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Корсаково",operator:"",desc:""},{mask:"+7(48672)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Долгое",operator:"",desc:""},{mask:"+7(48673)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Новосиль",operator:"",desc:""},{mask:"+7(48674)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Колпны",operator:"",desc:""},{mask:"+7(48675)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Глазуновка",operator:"",desc:""},{mask:"+7(48676)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Верховье",operator:"",desc:""},{mask:"+7(48677)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Ливны",operator:"",desc:""},{mask:"+7(48678)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Хомутово",operator:"",desc:""},{mask:"+7(48679)#-##-##",cc:"RU",cd:"Russia",region:"Орловская область",city:"Малоархангельск",operator:"",desc:""},{mask:"+7(487)###-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"",operator:"",desc:""},{mask:"+7(4872)##-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Тула",operator:"",desc:""},{mask:"+7(48731)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Узловая",operator:"",desc:""},{mask:"+7(48732)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Дубна",operator:"",desc:""},{mask:"+7(48733)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Арсеньево",operator:"",desc:""},{mask:"+7(48734)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Заокский",operator:"",desc:""},{mask:"+7(48735)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Кимовск",operator:"",desc:""},{mask:"+7(48736)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Одоев",operator:"",desc:""},{mask:"+7(48741)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Ефремов",operator:"",desc:""},{mask:"+7(48742)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Белев",operator:"",desc:""},{mask:"+7(48743)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Куркино",operator:"",desc:""},{mask:"+7(48744)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Архангельское",operator:"",desc:""},{mask:"+7(48745)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Венев",operator:"",desc:""},{mask:"+7(48746)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Донской",operator:"",desc:""},{mask:"+7(48751)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Щекино",operator:"",desc:""},{mask:"+7(48752)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Плавск",operator:"",desc:""},{mask:"+7(48753)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Алексин",operator:"",desc:""},{mask:"+7(48754)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Киреевск",operator:"",desc:""},{mask:"+7(48755)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Тёплое",operator:"",desc:""},{mask:"+7(48756)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Чернь",operator:"",desc:""},{mask:"+7(48761)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Богородицк",operator:"",desc:""},{mask:"+7(48762)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Новомосковск",operator:"",desc:""},{mask:"+7(48763)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Суворов",operator:"",desc:""},{mask:"+7(48766)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Ясногорск",operator:"",desc:""},{mask:"+7(48767)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Ленинский",operator:"",desc:""},{mask:"+7(48768)#-##-##",cc:"RU",cd:"Russia",region:"Тульская область",city:"Волово",operator:"",desc:""},{mask:"+7(491)###-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"",operator:"",desc:""},{mask:"+7(4912)##-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:["Рязань","Солотча"],operator:"",desc:""},{mask:"+7(49130)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Михайлов",operator:"",desc:""},{mask:"+7(49131)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Касимов",operator:"",desc:""},{mask:"+7(49132)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Ряжск",operator:"",desc:""},{mask:"+7(49133)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Сасово",operator:"",desc:""},{mask:"+7(49135)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Спасск-Рязанский",operator:"",desc:""},{mask:"+7(49136)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Шилово",operator:"",desc:""},{mask:"+7(49137)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Рыбное",operator:"",desc:""},{mask:"+7(49138)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Чучково",operator:"",desc:""},{mask:"+7(49139)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Кадом",operator:"",desc:""},{mask:"+7(49141)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Новомичуринск",operator:"",desc:""},{mask:"+7(49142)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Спас-Клепики",operator:"",desc:""},{mask:"+7(49143)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Кораблино",operator:"",desc:""},{mask:"+7(49144)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Ермишь",operator:"",desc:""},{mask:"+7(49145)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Пителино",operator:"",desc:""},{mask:"+7(49146)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Путятино",operator:"",desc:""},{mask:"+7(49147)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Шацк",operator:"",desc:""},{mask:"+7(49148)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Сараи",operator:"",desc:""},{mask:"+7(49151)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Старожилово",operator:"",desc:""},{mask:"+7(49152)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Сапожок",operator:"",desc:""},{mask:"+7(49153)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Захарово",operator:"",desc:""},{mask:"+7(49154)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Ухолово",operator:"",desc:""},{mask:"+7(49155)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Пронск",operator:"",desc:""},{mask:"+7(49156)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Скопин",operator:"",desc:""},{mask:"+7(49157)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Милославское",operator:"",desc:""},{mask:"+7(49158)#-##-##",cc:"RU",cd:"Russia",region:"Рязанская область",city:"Александро-Невский",operator:"",desc:""},{mask:"+7(492)###-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"",operator:"",desc:""},{mask:"+7(4922)##-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Владимир",operator:"",desc:""},{mask:"+7(49231)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Суздаль",operator:"",desc:""},{mask:"+7(49232)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Ковров",operator:"",desc:""},{mask:"+7(49233)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Вязники",operator:"",desc:""},{mask:"+7(49234)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Муром",operator:"",desc:""},{mask:"+7(49235)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Судогда",operator:"",desc:""},{mask:"+7(49236)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Красная Горбатка",operator:"",desc:""},{mask:"+7(49237)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Киржач",operator:"",desc:""},{mask:"+7(49238)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Гороховец",operator:"",desc:""},{mask:"+7(49241)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Гусь-Хрустальный",operator:"",desc:""},{mask:"+7(49242)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Собинка",operator:"",desc:""},{mask:"+7(49243)2-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Петушки",operator:"",desc:""},{mask:"+7(49243)6-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Покров",operator:"",desc:""},{mask:"+7(49244)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Александров",operator:"",desc:""},{mask:"+7(49245)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Кольчугино",operator:"",desc:""},{mask:"+7(49246)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Юрьев-Польский",operator:"",desc:""},{mask:"+7(49247)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Меленки",operator:"",desc:""},{mask:"+7(49248)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Камешково",operator:"",desc:""},{mask:"+7(49254)#-##-##",cc:"RU",cd:"Russia",region:"Владимирская область",city:"Радужный",operator:"",desc:""},{mask:"+7(493)###-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"",operator:"",desc:""},{mask:"+7(4932)##-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Иваново",operator:"",desc:""},{mask:"+7(49331)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Кинешма",operator:"",desc:""},{mask:"+7(49333)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Заволжск",operator:"",desc:""},{mask:"+7(49334)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Палех",operator:"",desc:""},{mask:"+7(49336)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Родники",operator:"",desc:""},{mask:"+7(49337)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Юрьевец",operator:"",desc:""},{mask:"+7(49339)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Приволжск",operator:"",desc:""},{mask:"+7(49341)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Фурманов",operator:"",desc:""},{mask:"+7(49343)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Тейково",operator:"",desc:""},{mask:"+7(49344)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Лух",operator:"",desc:""},{mask:"+7(49345)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Пучеж",operator:"",desc:""},{mask:"+7(49346)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Пестяки",operator:"",desc:""},{mask:"+7(49347)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Южа",operator:"",desc:""},{mask:"+7(49349)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Верхний Ландех",operator:"",desc:""},{mask:"+7(49351)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Шуя",operator:"",desc:""},{mask:"+7(49352)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Комсомольск",operator:"",desc:""},{mask:"+7(49353)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Ильинское-Хованское",operator:"",desc:""},{mask:"+7(49354)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Вичуга",operator:"",desc:""},{mask:"+7(49355)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Гаврилов Посад",operator:"",desc:""},{mask:"+7(49356)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Савино",operator:"",desc:""},{mask:"+7(49357)#-##-##",cc:"RU",cd:"Russia",region:"Ивановская область",city:"Лежнево",operator:"",desc:""},{mask:"+7(494)###-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"",operator:"",desc:""},{mask:"+7(4942)##-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Кострома",operator:"",desc:""},{mask:"+7(49430)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Антропово",operator:"",desc:""},{mask:"+7(49431)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Нерехта",operator:"",desc:""},{mask:"+7(49432)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Красное-на-Волге",operator:"",desc:""},{mask:"+7(49433)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Судиславль",operator:"",desc:""},{mask:"+7(49434)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Сусанино",operator:"",desc:""},{mask:"+7(49435)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Буй",operator:"",desc:""},{mask:"+7(49436)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Солигалич",operator:"",desc:""},{mask:"+7(49437)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Галич",operator:"",desc:""},{mask:"+7(49438)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Островское",operator:"",desc:""},{mask:"+7(49439)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Павино",operator:"",desc:""},{mask:"+7(49440)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Парфеньево",operator:"",desc:""},{mask:"+7(49441)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Чухлома",operator:"",desc:""},{mask:"+7(49442)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Кадый",operator:"",desc:""},{mask:"+7(49443)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Кологрив",operator:"",desc:""},{mask:"+7(49444)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Нея",operator:"",desc:""},{mask:"+7(49445)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Макарьев",operator:"",desc:""},{mask:"+7(49446)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Мантурово",operator:"",desc:""},{mask:"+7(49447)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Георгиевское",operator:"",desc:""},{mask:"+7(49448)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Поназырево",operator:"",desc:""},{mask:"+7(49449)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Шарья",operator:"",desc:""},{mask:"+7(49450)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Вохма",operator:"",desc:""},{mask:"+7(49451)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Боговарово",operator:"",desc:""},{mask:"+7(49452)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Пыщуг",operator:"",desc:""},{mask:"+7(49453)#-##-##",cc:"RU",cd:"Russia",region:"Костромская область",city:"Волгореченск",operator:"",desc:""},{mask:"+7(495)###-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"",operator:"",desc:""},{mask:"+7(495)323-8#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Аэропорт Домодедово",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)323-9#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Аэропорт Домодедово",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)338-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Мосрентген",operator:"МГТС",desc:"часть номеров АТС"},{mask:"+7(495)339-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Мосрентген",operator:"МГТС",desc:"часть номеров АТС"},{mask:"+7(495)355-9#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Развилка",operator:"ОАО «Газпромсвязь»",desc:""},{mask:"+7(495)408-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Долгопрудный",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)439-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Московский",operator:"ЦентрТелеком",desc:"часть номеров АТС"},{mask:"+7(495)50#-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Люберцы",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)500-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Москва",operator:["Мегафон","Центральный Телеграф"],desc:""},{mask:"+7(495)51#-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:["Королёв","Юбилейный"],operator:"ЦентрТелеком",desc:""},{mask:"+7(495)52#-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:["Балашиха","Железнодорожный","Реутов"],operator:"ЦентрТелеком",desc:""},{mask:"+7(495)541-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Видное",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)542-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Москва",operator:["Мегафон","Центральный Телеграф"],desc:""},{mask:"+7(495)543-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Москва",operator:["Мегафон","Центральный Телеграф"],desc:""},{mask:"+7(495)544-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Москва",operator:["Мегафон","Центральный Телеграф"],desc:""},{mask:"+7(495)545-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Москва",operator:["Мегафон","Центральный Телеграф"],desc:""},{mask:"+7(495)546-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Москва",operator:"Ростелеком",desc:""},{mask:"+7(495)546-1#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Домодедово",operator:"Ростелеком",desc:""},{mask:"+7(495)546-6#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:["Видное","Развилка"],operator:"Ростелеком",desc:""},{mask:"+7(495)546-8#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Домодедово",operator:"Ростелеком",desc:""},{mask:"+7(495)548-0#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Видное",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)548-1#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Видное",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)548-4#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Видное",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)548-5#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Видное",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)548-6#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Поселок совхоза им. Ленина",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)548-7#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:["Поселок совхоза им. Ленина","Поселок Володарского","Горки Ленинские"],operator:"ЦентрТелеком",desc:""},{mask:"+7(495)548-8#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:["Поселок Володарского","Горки Ленинские"],operator:"ЦентрТелеком",desc:""},{mask:"+7(495)548-9#-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Видное",operator:"ЦентрТелеком",desc:"промзона"},{mask:"+7(495)549-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:["Видное","Московский","пос. Ново-Дрожжино","пос. Измайлово","пос. Булатниково","пос. Дубровский","пос. Института Садоводства"],operator:"ЦентрТелеком",desc:""},{mask:"+7(495)55#-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Люберцы",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)552-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Лыткарино",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)555-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Лыткарино",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)56#-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Красногорск",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)57#-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:["Королёв","Мытищи","Юбилейный"],operator:"ЦентрТелеком",desc:""},{mask:"+7(495)573-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Химки",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)576-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Долгопрудный",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)577-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Лобня",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)578-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:["Лобня","Международный аэропорт «Шереметьево»"],operator:"Порт-Телеком",desc:""},{mask:"+7(495)579-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:["Долгопрудный","Лобня"],operator:"",desc:""},{mask:"+7(495)58#-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Химки",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)585-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Москва",operator:["Мегафон","Центральный Телеграф"],desc:""},{mask:"+7(495)589-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Москва",operator:["Мегафон","Центральный Телеграф"],desc:""},{mask:"+7(495)59#-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Одинцово",operator:"ЦентрТелеком",desc:""},{mask:"+7(495)597-##-##",cc:"RU",cd:"Russia",region:"Москва и ближнее Подмосковье",city:"Москва",operator:["Центральный Телеграф","ЦентрТелеком"],desc:""},{mask:"+7(496)###-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"",operator:"",desc:""},{mask:"+7(496)20#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Талдом",operator:"",desc:""},{mask:"+7(496)21#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Дубна",operator:"",desc:""},{mask:"+7(496)22#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Дмитров",operator:"",desc:""},{mask:"+7(496)24#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Клин",operator:"",desc:""},{mask:"+7(496)25#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Щёлковский район",operator:"",desc:""},{mask:"+7(496)26#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Солнечногорск",operator:"",desc:""},{mask:"+7(496)27#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Руза",operator:"",desc:""},{mask:"+7(496)28#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Лотошино",operator:"",desc:""},{mask:"+7(496)30#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"ЗАО Калита-Телеком",operator:"",desc:""},{mask:"+7(496)31#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Истра",operator:"",desc:""},{mask:"+7(496)34#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Наро-Фоминск",operator:"",desc:""},{mask:"+7(496)36#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Волоколамск",operator:"",desc:""},{mask:"+7(496)37#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Шаховская",operator:"",desc:""},{mask:"+7(496)38#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Можайск",operator:"",desc:""},{mask:"+7(496)40#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Егорьевск",operator:"",desc:""},{mask:"+7(496)41#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Орехово-Зуево",operator:"",desc:""},{mask:"+7(496)42#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Орехово-Зуево",operator:"",desc:""},{mask:"+7(496)43#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Павловский Посад",operator:"",desc:""},{mask:"+7(496)44#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Воскресенск",operator:"",desc:""},{mask:"+7(496)45#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Шатура",operator:"",desc:""},{mask:"+7(496)46#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Раменское",operator:"",desc:""},{mask:"+7(496)51#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Ногинск",operator:"",desc:""},{mask:"+7(496)52#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Черноголовка",operator:"",desc:""},{mask:"+7(496)53#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Пушкино",operator:"",desc:""},{mask:"+7(496)54#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Сергиев Посад",operator:"",desc:""},{mask:"+7(496)55#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Сергиев Посад",operator:"",desc:""},{mask:"+7(496)56#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Щелково",operator:"",desc:""},{mask:"+7(496)57#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Электросталь",operator:"",desc:""},{mask:"+7(496)61#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Коломна",operator:"",desc:""},{mask:"+7(496)63#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Луховицы",operator:"",desc:""},{mask:"+7(496)64#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Ступино",operator:"",desc:""},{mask:"+7(496)66#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Зарайск",operator:"",desc:""},{mask:"+7(496)67#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Серебряные Пруды",operator:"",desc:""},{mask:"+7(496)69#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Кашира",operator:"",desc:""},{mask:"+7(496)70#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Озеры",operator:"",desc:""},{mask:"+7(496)72#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Чехов",operator:"",desc:""},{mask:"+7(496)73#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Серпухов",operator:"",desc:""},{mask:"+7(496)75#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Подольск",operator:"",desc:""},{mask:"+7(496)76#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Подольск",operator:"",desc:""},{mask:"+7(496)77#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Серпухов",operator:"",desc:""},{mask:"+7(496)79#-##-##",cc:"RU",cd:"Russia",region:"Московская область",city:"Домодедово",operator:"",desc:""},{mask:"+7(498)###-##-##",cc:"RU",cd:"Russia",region:"Лесопарковый защитный пояс Москвы",city:"",operator:"",desc:""},{mask:"+7(498)48#-##-##",cc:"RU",cd:"Russia",region:"Лесопарковый защитный пояс Москвы",city:"Жуковский",operator:"",desc:""},{mask:"+7(498)54#-##-##",cc:"RU",cd:"Russia",region:"Лесопарковый защитный пояс Москвы",city:["Видное","Ленинский район"],operator:"ЦентрТелеком",desc:""},{mask:"+7(498)617-##-##",cc:"RU",cd:"Russia",region:"Лесопарковый защитный пояс Москвы",city:["Газопровод","Коммунарка"],operator:"ЗАО «Газтелеком»",desc:"Ленинский район"},{mask:"+7(498)657-##-##",cc:"RU",cd:"Russia",region:"Лесопарковый защитный пояс Москвы",city:"Развилка",operator:"ООО «Газпром связь»",desc:"Ленинский район"},{mask:"+7(498)664-##-##",cc:"RU",cd:"Russia",region:"Лесопарковый защитный пояс Москвы",city:"Железнодорожный",operator:"",desc:""},{mask:"+7(498)68#-##-##",cc:"RU",cd:"Russia",region:"Лесопарковый защитный пояс Москвы",city:"Лобня",operator:"",desc:""},{mask:"+7(498)713-##-##",cc:"RU",cd:"Russia",region:"Лесопарковый защитный пояс Москвы",city:"Долгопрудный",operator:"",desc:""},{mask:"+7(498)744-##-##",cc:"RU",cd:"Russia",region:"Лесопарковый защитный пояс Москвы",city:"Долгопрудный",operator:"",desc:""},{mask:"+7(499)###-##-##",cc:"RU",cd:"Russia",region:"Москва",city:"",operator:"",desc:""},{mask:"+7(499)39#-##-##",cc:"RU",cd:"Russia",region:"Москва",city:"Москва",operator:"МегаФон",desc:""},{mask:"+7(499)50#-##-##",cc:"RU",cd:"Russia",region:"Москва",city:"Москва",operator:"Центральный Телеграф",desc:""},{mask:"+7(499)755-##-##",cc:"RU",cd:"Russia",region:"Москва",city:"Москва",operator:"МегаФон",desc:""},{mask:"+7(811)###-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"",operator:"",desc:""},{mask:"+7(8112)##-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Псков",operator:"",desc:""},{mask:"+7(81131)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Гдов",operator:"",desc:""},{mask:"+7(81132)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Струги Красные",operator:"",desc:""},{mask:"+7(81133)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Плюсса",operator:"",desc:""},{mask:"+7(81134)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Порхов",operator:"",desc:""},{mask:"+7(81135)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Дно",operator:"",desc:""},{mask:"+7(81136)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Дедовичи",operator:"",desc:""},{mask:"+7(81137)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Красногородск",operator:"",desc:""},{mask:"+7(81138)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Опочка",operator:"",desc:""},{mask:"+7(81139)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Локня",operator:"",desc:""},{mask:"+7(81140)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Себеж",operator:"",desc:""},{mask:"+7(81141)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Бежаницы",operator:"",desc:""},{mask:"+7(81142)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Пустошка",operator:"",desc:""},{mask:"+7(81143)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Новоржев",operator:"",desc:""},{mask:"+7(81144)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Новосокольники",operator:"",desc:""},{mask:"+7(81145)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Палкино",operator:"",desc:""},{mask:"+7(81146)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Пушкинские Горы",operator:"",desc:""},{mask:"+7(81147)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Пыталово",operator:"",desc:""},{mask:"+7(81148)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Печоры",operator:"",desc:""},{mask:"+7(81149)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Кунья",operator:"",desc:""},{mask:"+7(81150)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Усвяты",operator:"",desc:""},{mask:"+7(81151)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Невель",operator:"",desc:""},{mask:"+7(81152)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Остров",operator:"",desc:""},{mask:"+7(81153)#-##-##",cc:"RU",cd:"Russia",region:"Псковская область",city:"Великие Луки",operator:"",desc:""},{mask:"+7(812)###-##-##",cc:"RU",cd:"Russia",region:"Санкт-Петербург",city:"",operator:"",desc:""},{mask:"+7(813)###-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:"",operator:"",desc:""},{mask:"+7(81361)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:"Тосно",operator:"",desc:""},{mask:"+7(81362)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:["Кировск","Шлиссельбург"],operator:"",desc:""},{mask:"+7(81363)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:["Волхов","Новая Ладога","Сясьстрой"],operator:"",desc:""},{mask:"+7(81364)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:"Лодейное Поле",operator:"",desc:""},{mask:"+7(81365)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:"Подпорожье",operator:"",desc:""},{mask:"+7(81366)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:["Бокситогорск","Пикалёво"],operator:"",desc:""},{mask:"+7(81367)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:"Тихвин",operator:"",desc:""},{mask:"+7(81368)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:["Кириши","Будогощь"],operator:"",desc:""},{mask:"+7(81369)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:"Сосновый Бор",operator:"",desc:""},{mask:"+7(81370)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:["Всеволожск","Токсово"],operator:"",desc:""},{mask:"+7(81371)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:["Гатчина","Вырица","Коммунар"],operator:"",desc:""},{mask:"+7(81372)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:"Луга",operator:"",desc:""},{mask:"+7(81373)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:"Волосово",operator:"",desc:""},{mask:"+7(81374)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:"Сланцы",operator:"",desc:""},{mask:"+7(81375)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:["Кингисепп","Ивангород"],operator:"",desc:""},{mask:"+7(81376)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:"Ломоносов",operator:"",desc:""},{mask:"+7(81378)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:["Выборг","Высоцк","Приморск","Светогорск"],operator:"",desc:""},{mask:"+7(81379)#-##-##",cc:"RU",cd:"Russia",region:"Ленинградская область",city:"Приозерск",operator:"",desc:""},{mask:"+7(814)###-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"",operator:"",desc:""},{mask:"+7(8142)##-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Петрозаводск",operator:"",desc:""},{mask:"+7(81430)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Сортавала",operator:"",desc:""},{mask:"+7(81430)3-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Вяртсиля",operator:"",desc:""},{mask:"+7(81430)3-1#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Хелюля",operator:"",desc:""},{mask:"+7(81430)3-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Рускеала",operator:"",desc:""},{mask:"+7(81430)3-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Пуйккола",operator:"",desc:""},{mask:"+7(81430)3-5#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Хаапалампи",operator:"",desc:""},{mask:"+7(81430)3-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Кааламо",operator:"",desc:""},{mask:"+7(81430)3-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Заозёрный","Ламберг","Сортавала","Хюмпеля"],operator:"",desc:""},{mask:"+7(81431)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Сегежа",operator:"",desc:""},{mask:"+7(81431)3-0#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Кочкома",operator:"",desc:""},{mask:"+7(81431)3-1#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Олений","Пертозеро","Черный Порог"],operator:"",desc:""},{mask:"+7(81431)3-2#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Валдай",operator:"",desc:""},{mask:"+7(81431)3-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Волдозеро","Идель","Кяргозеро","Попов Порог"],operator:"",desc:""},{mask:"+7(81431)3-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Каменный Бор",operator:"",desc:""},{mask:"+7(81431)3-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Полга",operator:"",desc:""},{mask:"+7(81431)3-8#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Надвоицы",operator:"",desc:""},{mask:"+7(81433)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Питкяранта",operator:"",desc:""},{mask:"+7(81433)2-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Ляскеля","Рауталахти","Харлу","Хийденсельга"],operator:"",desc:""},{mask:"+7(81433)2-5#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Ряймяля","Салми"],operator:"",desc:""},{mask:"+7(81433)2-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Импилахти",operator:"",desc:""},{mask:"+7(81433)2-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Леппясилта","Уукса"],operator:"",desc:""},{mask:"+7(81434)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Медвежьегорск",operator:"",desc:""},{mask:"+7(81434)3-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Толвуя",operator:"",desc:""},{mask:"+7(81434)3-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Шуньга",operator:"",desc:""},{mask:"+7(81434)3-5#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Великая Губа","Великая Нива","Кижи","Космозеро","Ламбасручей","Сенная Губа"],operator:"",desc:""},{mask:"+7(81434)3-8#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Кумса","Лавас Губа","Лумбуши","Чебино"],operator:"",desc:""},{mask:"+7(81434)3-9#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Волозеро","Габсельга","Сосновка","Челмужи"],operator:"",desc:""},{mask:"+7(81434)4-2#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Огорелыши","Сергиево"],operator:"",desc:""},{mask:"+7(81434)4-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Повенец",operator:"",desc:""},{mask:"+7(81434)4-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Пиндуши",operator:"",desc:""},{mask:"+7(81434)4-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Паданы",operator:"",desc:""},{mask:"+7(81436)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Олонец",operator:"",desc:""},{mask:"+7(81436)2-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Ильинский",operator:"",desc:""},{mask:"+7(81436)2-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Верхний Олонец","Ковера","Речная Сельга","Сяндеба","Тулокса"],operator:"",desc:""},{mask:"+7(81436)2-5#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Михайловское",operator:"",desc:""},{mask:"+7(81436)2-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Алексала","Мегрега","Рыпушкалица","Тукса"],operator:"",desc:""},{mask:"+7(81436)2-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Видлица",operator:"",desc:""},{mask:"+7(81436)2-8#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Коткозеро",operator:"",desc:""},{mask:"+7(81436)2-9#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Куйтежа",operator:"",desc:""},{mask:"+7(81437)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Беломорск",operator:"",desc:""},{mask:"+7(81437)3-0#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Сумский Посад",operator:"",desc:""},{mask:"+7(81437)3-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Золотец",operator:"",desc:""},{mask:"+7(81437)3-5#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Колежма","Лапино","Лехта","Маленьга","Новое Машозеро","Нюхча","Тунгуза","Хвойный","Шуерецкое"],operator:"",desc:""},{mask:"+7(81437)3-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Сосновец",operator:"",desc:""},{mask:"+7(81437)3-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Лесобиржа",operator:"",desc:""},{mask:"+7(81437)3-8#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Вирандозеро","Летнереченский"],operator:"",desc:""},{mask:"+7(81437)3-9#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Пушной",operator:"",desc:""},{mask:"+7(81439)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Лоухи",operator:"",desc:""},{mask:"+7(81439)2-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Кестеньга",operator:"",desc:""},{mask:"+7(81439)2-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Софпорог","Тунгозеро"],operator:"",desc:""},{mask:"+7(81439)2-8#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Пяозерский",operator:"",desc:""},{mask:"+7(81439)3-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Амбарный","Плотина","Сосновый","Энгозеро"],operator:"",desc:""},{mask:"+7(81439)4-1#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Чупа",operator:"",desc:""},{mask:"+7(81439)4-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Чкаловский",operator:"",desc:""},{mask:"+7(81439)45#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Тэдино",operator:"",desc:""},{mask:"+7(81450)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Лахденпохья",operator:"",desc:""},{mask:"+7(81450)2-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Ихала","Мийнала","Яккима"],operator:"",desc:""},{mask:"+7(81450)2-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Куркиёки","Хийтола"],operator:"",desc:""},{mask:"+7(81450)2-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Элисенваара",operator:"",desc:""},{mask:"+7(81451)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Кондопога",operator:"",desc:""},{mask:"+7(81451)2-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Кедрозеро",operator:"",desc:""},{mask:"+7(81451)3-1#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Гирвас","Тивдия","Эльмус"],operator:"",desc:""},{mask:"+7(81451)3-2#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Спасская Губа",operator:"",desc:""},{mask:"+7(81451)3-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Кивач","Новинка"],operator:"",desc:""},{mask:"+7(81451)3-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Кяпесельга","Нелгомозеро"],operator:"",desc:""},{mask:"+7(81451)3-5#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Кончезеро",operator:"",desc:""},{mask:"+7(81451)3-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Берёзовка",operator:"",desc:""},{mask:"+7(81451)3-9#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Суна","Янишполе"],operator:"",desc:""},{mask:"+7(81452)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Пудож",operator:"",desc:""},{mask:"+7(81452)2-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Бочилово","Каршево","Колово","Колодозеро","Семёново"],operator:"",desc:""},{mask:"+7(81452)2-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Водла","Кубово","Онежский","Рагнукса"],operator:"",desc:""},{mask:"+7(81452)2-5#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Кривцы","Приречный"],operator:"",desc:""},{mask:"+7(81452)2-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Авдеево",operator:"",desc:""},{mask:"+7(81452)2-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Подпорожье",operator:"",desc:""},{mask:"+7(81452)2-8#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Шала",operator:"",desc:""},{mask:"+7(81452)2-9#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Пяльма",operator:"",desc:""},{mask:"+7(81454)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Калевала",operator:"",desc:""},{mask:"+7(81454)5-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Кепа",operator:"",desc:""},{mask:"+7(81454)5-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Юшкозеро",operator:"",desc:""},{mask:"+7(81454)5-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Войница","Куусиниеми","Луусалми"],operator:"",desc:""},{mask:"+7(81455)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Муезерский",operator:"",desc:""},{mask:"+7(81455)2-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Тикша",operator:"",desc:""},{mask:"+7(81455)2-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Реболы",operator:"",desc:""},{mask:"+7(81455)2-5#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Ригозеро",operator:"",desc:""},{mask:"+7(81455)2-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Волома","Пенинга"],operator:"",desc:""},{mask:"+7(81455)2-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Суккозеро",operator:"",desc:""},{mask:"+7(81455)2-8#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Ледмозеро",operator:"",desc:""},{mask:"+7(81455)2-9#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Лендеры",operator:"",desc:""},{mask:"+7(81456)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Пряжа",operator:"",desc:""},{mask:"+7(81456)2-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Вилла Гора","Соддер","Сяпся","Эссойла"],operator:"",desc:""},{mask:"+7(81456)2-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Ведлозеро","Кинелахта","Койвусельга","Колатсельга","Савиново"],operator:"",desc:""},{mask:"+7(81456)2-5#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Чална",operator:"",desc:""},{mask:"+7(81456)2-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Матросы",operator:"",desc:""},{mask:"+7(81456)2-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Верхние Важины",operator:"",desc:""},{mask:"+7(81456)2-8#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Крошнозеро",operator:"",desc:""},{mask:"+7(81456)2-9#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Святозеро",operator:"",desc:""},{mask:"+7(81457)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Суоярви",operator:"",desc:""},{mask:"+7(81457)2-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Лахколамби",operator:"",desc:""},{mask:"+7(81457)2-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Поросозеро",operator:"",desc:""},{mask:"+7(81457)2-5#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Найстеньярви",operator:"",desc:""},{mask:"+7(81457)2-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Вегарус","Суоёки","Тойвола","Хаутоваара"],operator:"",desc:""},{mask:"+7(81457)2-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Вешкелица","Лоймола","Пийтсиёки"],operator:"",desc:""},{mask:"+7(81457)2-9#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Леппясюрья","Райконкоски","Суйстамо"],operator:"",desc:""},{mask:"+7(81457)3-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Леппяниеми",operator:"",desc:""},{mask:"+7(81458)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Кемь",operator:"",desc:""},{mask:"+7(81458)3-1#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Калгалакша",operator:"",desc:""},{mask:"+7(81458)3-2#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Панозеро","Поньгома"],operator:"",desc:""},{mask:"+7(81458)3-4#-##",cc:"RU",cd:"Russia",region:"Карелия",city:["Авнепорог","Кривой Порог"],operator:"",desc:""},{mask:"+7(81458)3-5#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Рабочеостровск",operator:"",desc:""},{mask:"+7(81458)3-6#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Шомба",operator:"",desc:""},{mask:"+7(81458)3-7#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Кузема",operator:"",desc:""},{mask:"+7(81458)3-8#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Баб-Губа",operator:"",desc:""},{mask:"+7(81458)3-9#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Сокол",operator:"",desc:""},{mask:"+7(81459)#-##-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Костомукша",operator:"",desc:""},{mask:"+7(81459)9-3#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Контокки",operator:"",desc:""},{mask:"+7(81459)9-5#-##",cc:"RU",cd:"Russia",region:"Карелия",city:"Вокнаволок",operator:"",desc:""},{mask:"+7(815)###-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"",operator:"",desc:""},{mask:"+7(8152)##-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Мурманск",operator:"",desc:""},{mask:"+7(81530)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Снежногорск",operator:"",desc:""},{mask:"+7(81531)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Кировск",operator:"",desc:""},{mask:"+7(81532)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Полярные Зори",operator:"",desc:""},{mask:"+7(81533)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Кандалакша",operator:"",desc:""},{mask:"+7(81535)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Ковдор",operator:"",desc:""},{mask:"+7(81536)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Мончегорск",operator:"",desc:""},{mask:"+7(81537)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Североморск",operator:"",desc:""},{mask:"+7(81538)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Ловозеро",operator:"",desc:""},{mask:"+7(81539)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Гаджиево",operator:"",desc:""},{mask:"+7(81551)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Полярный",operator:"",desc:""},{mask:"+7(81552)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Оленегорск",operator:"",desc:""},{mask:"+7(81553)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Кола",operator:"",desc:""},{mask:"+7(81554)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:["Заполярный","Никель"],operator:"",desc:""},{mask:"+7(81555)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Апатиты",operator:"",desc:""},{mask:"+7(81556)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Заозерск",operator:"",desc:""},{mask:"+7(81558)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Островной",operator:"",desc:""},{mask:"+7(81559)#-##-##",cc:"RU",cd:"Russia",region:"Мурманская область",city:"Умба",operator:"",desc:""},{mask:"+7(816)###-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"",operator:"",desc:""},{mask:"+7(8162)##-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Великий Новгород",operator:"",desc:""},{mask:"+7(81650)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Парфино",operator:"",desc:""},{mask:"+7(81651)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Демянск",operator:"",desc:""},{mask:"+7(81652)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Старая Русса",operator:"",desc:""},{mask:"+7(81653)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Мошенское",operator:"",desc:""},{mask:"+7(81654)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Холм",operator:"",desc:""},{mask:"+7(81655)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Сольцы",operator:"",desc:""},{mask:"+7(81656)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Шимск",operator:"",desc:""},{mask:"+7(81657)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Окуловка",operator:"",desc:""},{mask:"+7(81658)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Поддорье",operator:"",desc:""},{mask:"+7(81659)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Крестцы",operator:"",desc:""},{mask:"+7(81660)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Малая Вишера",operator:"",desc:""},{mask:"+7(81661)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Батецкий",operator:"",desc:""},{mask:"+7(81662)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Волот",operator:"",desc:""},{mask:"+7(81663)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Марёво",operator:"",desc:""},{mask:"+7(81664)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Боровичи",operator:"",desc:""},{mask:"+7(81665)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Чудово",operator:"",desc:""},{mask:"+7(81666)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Валдай",operator:"",desc:""},{mask:"+7(81667)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Хвойная",operator:"",desc:""},{mask:"+7(81668)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Любытино",operator:"",desc:""},{mask:"+7(81669)#-##-##",cc:"RU",cd:"Russia",region:"Новгородская область",city:"Пестово",operator:"",desc:""},{mask:"+7(817)###-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"",operator:"",desc:""},{mask:"+7(8172)##-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Вологда",operator:"",desc:""},{mask:"+7(81732)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Харовск",operator:"",desc:""},{mask:"+7(81733)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Сокол",operator:"",desc:""},{mask:"+7(81737)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Устюжна",operator:"",desc:""},{mask:"+7(81738)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Великий Устюг",operator:"",desc:""},{mask:"+7(81739)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Тотьма",operator:"",desc:""},{mask:"+7(81740)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Кичменгский Городок",operator:"",desc:""},{mask:"+7(81741)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Чагода",operator:"",desc:""},{mask:"+7(81742)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Кадуй",operator:"",desc:""},{mask:"+7(81743)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Бабаево",operator:"",desc:""},{mask:"+7(81744)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Вожега",operator:"",desc:""},{mask:"+7(81745)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Село имени Бабушкина",operator:"",desc:""},{mask:"+7(81746)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Вытегра",operator:"",desc:""},{mask:"+7(81747)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Нюксеница",operator:"",desc:""},{mask:"+7(81748)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Тарногский Городок",operator:"",desc:""},{mask:"+7(81749)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Шуйское",operator:"",desc:""},{mask:"+7(81751)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Шексна",operator:"",desc:""},{mask:"+7(81752)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Сямжа",operator:"",desc:""},{mask:"+7(81753)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Устье",operator:"",desc:""},{mask:"+7(81754)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Никольск",operator:"",desc:""},{mask:"+7(81755)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Грязовец",operator:"",desc:""},{mask:"+7(81756)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Белозерск",operator:"",desc:""},{mask:"+7(81757)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Кириллов",operator:"",desc:""},{mask:"+7(81758)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Липин Бор",operator:"",desc:""},{mask:"+7(81759)#-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Верховажье",operator:"",desc:""},{mask:"+7(818)###-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Архангельск",operator:"",desc:""},{mask:"+7(81830)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Холмогоры",operator:"",desc:""},{mask:"+7(81831)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Березник",operator:"",desc:""},{mask:"+7(81832)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Плесецк",operator:"",desc:""},{mask:"+7(81833)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Лешуконское",operator:"",desc:""},{mask:"+7(81834)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Мирный",operator:"",desc:""},{mask:"+7(81835)9-0#-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Соловецкий",operator:"",desc:""},{mask:"+7(81836)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Вельск",operator:"",desc:""},{mask:"+7(81837)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Котлас",operator:"",desc:""},{mask:"+7(81838)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Няндома",operator:"",desc:""},{mask:"+7(81839)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Онега",operator:"",desc:""},{mask:"+7(81840)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Красноборск",operator:"",desc:""},{mask:"+7(81841)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Каргополь",operator:"",desc:""},{mask:"+7(81842)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Северодвинск",operator:"",desc:""},{mask:"+7(81843)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Ильинско-Подомское",operator:"",desc:""},{mask:"+7(81848)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Мезень",operator:"",desc:""},{mask:"+7(81850)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Коряжма",operator:"",desc:""},{mask:"+7(81851)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Шенкурск",operator:"",desc:""},{mask:"+7(81852)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Новодвинск",operator:"",desc:""},{mask:"+7(81853)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Нарьян-Мар",operator:"",desc:""},{mask:"+7(81854)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Верхняя Тойма",operator:"",desc:""},{mask:"+7(81855)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Октябрьский",operator:"",desc:""},{mask:"+7(81856)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Карпогоры",operator:"",desc:""},{mask:"+7(81858)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Коноша",operator:"",desc:""},{mask:"+7(81859)#-##-##",cc:"RU",cd:"Russia",region:["Архангельская область","Ненецкий автономный округ"],city:"Яренск",operator:"",desc:""},{mask:"+7(820)###-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"",operator:"",desc:""},{mask:"+7(8202)##-##-##",cc:"RU",cd:"Russia",region:"Вологодская область",city:"Череповец",operator:"",desc:""},{mask:"+7(821)###-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"",operator:"",desc:""},{mask:"+7(8212)##-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Сыктывкар",operator:"",desc:""},{mask:"+7(82130)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Выльгорт",operator:"",desc:""},{mask:"+7(82131)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Визинга",operator:"",desc:""},{mask:"+7(82132)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Койгородок",operator:"",desc:""},{mask:"+7(82133)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Объячево",operator:"",desc:""},{mask:"+7(82134)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Айкино",operator:"",desc:""},{mask:"+7(82135)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Усогорск",operator:"",desc:""},{mask:"+7(82136)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Корткерос",operator:"",desc:""},{mask:"+7(82137)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Усть-Кулом",operator:"",desc:""},{mask:"+7(82138)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Троицко-Печорск",operator:"",desc:""},{mask:"+7(82139)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Емва",operator:"",desc:""},{mask:"+7(82140)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Ижма",operator:"",desc:""},{mask:"+7(82141)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Усть-Цильма",operator:"",desc:""},{mask:"+7(82142)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Печора",operator:"",desc:""},{mask:"+7(82144)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Усинск",operator:"",desc:""},{mask:"+7(82145)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Инта",operator:"",desc:""},{mask:"+7(82146)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Вуктыл",operator:"",desc:""},{mask:"+7(82149)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Сосногорск",operator:"",desc:""},{mask:"+7(82151)#-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Воркута",operator:"",desc:""},{mask:"+7(8216)##-##-##",cc:"RU",cd:"Russia",region:"Республика Коми",city:"Ухта",operator:"",desc:""},{mask:"+7(831)###-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Нижний Новгород",operator:"",desc:""},{mask:"+7(8313)##-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Дзержинск",operator:"",desc:""},{mask:"+7(83130)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Саров",operator:"",desc:""},{mask:"+7(83134)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Дивеево",operator:"",desc:""},{mask:"+7(83136)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Володарск",operator:"",desc:""},{mask:"+7(83137)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Сокольское",operator:"",desc:""},{mask:"+7(83138)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Большое Болдино",operator:"",desc:""},{mask:"+7(83139)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Первомайск",operator:"",desc:""},{mask:"+7(83140)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Вад",operator:"",desc:""},{mask:"+7(83144)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Балахна",operator:"",desc:""},{mask:"+7(83145)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Кстово",operator:"",desc:""},{mask:"+7(83147)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Арзамас",operator:"",desc:""},{mask:"+7(83148)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Перевоз",operator:"",desc:""},{mask:"+7(83149)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Лысково",operator:"",desc:""},{mask:"+7(83150)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Ветлуга",operator:"",desc:""},{mask:"+7(83151)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Тоншаево",operator:"",desc:""},{mask:"+7(83152)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Шахунья",operator:"",desc:""},{mask:"+7(83153)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Тонкино",operator:"",desc:""},{mask:"+7(83154)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Урень",operator:"",desc:""},{mask:"+7(83155)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Шаранга",operator:"",desc:""},{mask:"+7(83156)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Красные Баки",operator:"",desc:""},{mask:"+7(83157)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Ковернино",operator:"",desc:""},{mask:"+7(83158)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Варнавино",operator:"",desc:""},{mask:"+7(83159)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Бор",operator:"",desc:""},{mask:"+7(83160)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Чкаловск",operator:"",desc:""},{mask:"+7(83161)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Городец",operator:"",desc:""},{mask:"+7(83162)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Семёнов",operator:"",desc:""},{mask:"+7(83163)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Воскресенское",operator:"",desc:""},{mask:"+7(83164)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Воротынец",operator:"",desc:""},{mask:"+7(83165)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Спасское",operator:"",desc:""},{mask:"+7(83166)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Княгинино",operator:"",desc:""},{mask:"+7(83167)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Большое Мурашкино",operator:"",desc:""},{mask:"+7(83168)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Дальнее Константиново",operator:"",desc:""},{mask:"+7(83169)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Заволжье",operator:"",desc:""},{mask:"+7(83170)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Богородск",operator:"",desc:""},{mask:"+7(83171)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:["Павлово","Ворсма"],operator:"",desc:""},{mask:"+7(83172)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Бутурлино",operator:"",desc:""},{mask:"+7(83173)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Вача",operator:"",desc:""},{mask:"+7(83174)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Сосновское",operator:"",desc:""},{mask:"+7(83175)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Навашино",operator:"",desc:""},{mask:"+7(83176)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Кулебаки",operator:"",desc:""},{mask:"+7(83177)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Выкса",operator:"",desc:""},{mask:"+7(83178)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Вознесенское",operator:"",desc:""},{mask:"+7(83179)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Ардатов",operator:"",desc:""},{mask:"+7(83190)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Шатки",operator:"",desc:""},{mask:"+7(83191)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Сергач",operator:"",desc:""},{mask:"+7(83192)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Пильна",operator:"",desc:""},{mask:"+7(83193)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Сеченово",operator:"",desc:""},{mask:"+7(83194)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Уразовка",operator:"",desc:""},{mask:"+7(83195)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Гагино",operator:"",desc:""},{mask:"+7(83196)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Лукоянов",operator:"",desc:""},{mask:"+7(83197)#-##-##",cc:"RU",cd:"Russia",region:"Нижегородская область",city:"Починки",operator:"",desc:""},{mask:"+7(833)###-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"",operator:"",desc:""},{mask:"+7(8332)##-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Киров",operator:"",desc:""},{mask:"+7(83330)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Арбаж",operator:"",desc:""},{mask:"+7(83331)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Афанасьево",operator:"",desc:""},{mask:"+7(83332)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Фаленки",operator:"",desc:""},{mask:"+7(83333)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Богородское",operator:"",desc:""},{mask:"+7(83334)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Вятские Поляны",operator:"",desc:""},{mask:"+7(83335)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Верхошижемье",operator:"",desc:""},{mask:"+7(83336)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Даровской",operator:"",desc:""},{mask:"+7(83337)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Зуевка",operator:"",desc:""},{mask:"+7(83338)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Кильмезь",operator:"",desc:""},{mask:"+7(83339)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Кирс",operator:"",desc:""},{mask:"+7(83340)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Тужа",operator:"",desc:""},{mask:"+7(83341)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Кикнур",operator:"",desc:""},{mask:"+7(83342)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Котельнич",operator:"",desc:""},{mask:"+7(83343)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Кумены",operator:"",desc:""},{mask:"+7(83344)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Лебяжье",operator:"",desc:""},{mask:"+7(83345)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Ленинское",operator:"",desc:""},{mask:"+7(83346)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Луза",operator:"",desc:""},{mask:"+7(83347)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Малмыж",operator:"",desc:""},{mask:"+7(83348)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Мураши",operator:"",desc:""},{mask:"+7(83349)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Нагорск",operator:"",desc:""},{mask:"+7(83350)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Нема",operator:"",desc:""},{mask:"+7(83351)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Подосиновец",operator:"",desc:""},{mask:"+7(83352)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Омутнинск",operator:"",desc:""},{mask:"+7(83353)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Опарино",operator:"",desc:""},{mask:"+7(83354)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Оричи",operator:"",desc:""},{mask:"+7(83355)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Пижанка",operator:"",desc:""},{mask:"+7(83357)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Санчурск",operator:"",desc:""},{mask:"+7(83358)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Свеча",operator:"",desc:""},{mask:"+7(83359)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Уни",operator:"",desc:""},{mask:"+7(83361)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Кирово-Чепецк",operator:"",desc:""},{mask:"+7(83362)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Слободской",operator:"",desc:""},{mask:"+7(83363)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Уржум",operator:"",desc:""},{mask:"+7(83364)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Белая Холуница",operator:"",desc:""},{mask:"+7(83365)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Орлов",operator:"",desc:""},{mask:"+7(83366)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Юрья",operator:"",desc:""},{mask:"+7(83367)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Яранск",operator:"",desc:""},{mask:"+7(83368)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Нолинск",operator:"",desc:""},{mask:"+7(83369)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Суна",operator:"",desc:""},{mask:"+7(83375)#-##-##",cc:"RU",cd:"Russia",region:"Кировская область",city:"Советск",operator:"",desc:""},{mask:"+7(834)###-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"",operator:"",desc:""},{mask:"+7(8342)##-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Саранск",operator:"",desc:""},{mask:"+7(83431)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Ардатов",operator:"",desc:""},{mask:"+7(83432)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Старое Шайгово",operator:"",desc:""},{mask:"+7(83433)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Кемля",operator:"",desc:""},{mask:"+7(83434)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Атяшево",operator:"",desc:""},{mask:"+7(83436)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Большие Березники",operator:"",desc:""},{mask:"+7(83437)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Чамзинка",operator:"",desc:""},{mask:"+7(83438)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Ромоданово",operator:"",desc:""},{mask:"+7(83439)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Кочкурово",operator:"",desc:""},{mask:"+7(83441)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Лямбирь",operator:"",desc:""},{mask:"+7(83442)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Большое Игнатово",operator:"",desc:""},{mask:"+7(83443)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Краснослободск",operator:"",desc:""},{mask:"+7(83444)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Ельники",operator:"",desc:""},{mask:"+7(83445)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Темников",operator:"",desc:""},{mask:"+7(83446)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Теньгушево",operator:"",desc:""},{mask:"+7(83447)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Дубенки",operator:"",desc:""},{mask:"+7(83448)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Кадошкино",operator:"",desc:""},{mask:"+7(83449)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Инсар",operator:"",desc:""},{mask:"+7(83451)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Рузаевка",operator:"",desc:""},{mask:"+7(83453)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Ковылкино",operator:"",desc:""},{mask:"+7(83454)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Атюрьево",operator:"",desc:""},{mask:"+7(83456)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Торбеево",operator:"",desc:""},{mask:"+7(83457)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Явас",operator:"",desc:""},{mask:"+7(83458)#-##-##",cc:"RU",cd:"Russia",region:"Мордовия",city:"Зубова Поляна",operator:"",desc:""},{mask:"+7(835)###-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"",operator:"",desc:""},{mask:"+7(8352)##-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Чебоксары",operator:"",desc:""},{mask:"+7(8352)7#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Новочебоксарск",operator:"",desc:""},{mask:"+7(83530)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Красноармейское",operator:"",desc:""},{mask:"+7(83531)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Алатырь",operator:"",desc:""},{mask:"+7(83532)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Батырево",operator:"",desc:""},{mask:"+7(83533)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Канаш",operator:"",desc:""},{mask:"+7(83534)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Козловка",operator:"",desc:""},{mask:"+7(83535)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Аликово",operator:"",desc:""},{mask:"+7(83536)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Шумерля",operator:"",desc:""},{mask:"+7(83537)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Вурнары",operator:"",desc:""},{mask:"+7(83538)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Ибреси",operator:"",desc:""},{mask:"+7(83539)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Комсомольское",operator:"",desc:""},{mask:"+7(83540)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Кугеси",operator:"",desc:""},{mask:"+7(83541)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Моргауши",operator:"",desc:""},{mask:"+7(83542)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Мариинский Посад",operator:"",desc:""},{mask:"+7(83543)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Порецкое",operator:"",desc:""},{mask:"+7(83544)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Урмары",operator:"",desc:""},{mask:"+7(83545)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Цивильск",operator:"",desc:""},{mask:"+7(83546)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Шемурша",operator:"",desc:""},{mask:"+7(83547)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Ядрин",operator:"",desc:""},{mask:"+7(83548)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Янтиково",operator:"",desc:""},{mask:"+7(83549)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Яльчики",operator:"",desc:""},{mask:"+7(83551)#-##-##",cc:"RU",cd:"Russia",region:"Чувашия",city:"Красные Четаи",operator:"",desc:""},{mask:"+7(836)###-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"",operator:"",desc:""},{mask:"+7(8362)##-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Йошкар-Ола",operator:"",desc:""},{mask:"+7(83631)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Волжск",operator:"",desc:""},{mask:"+7(83632)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Козьмодемьянск",operator:"",desc:""},{mask:"+7(83633)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Сернур",operator:"",desc:""},{mask:"+7(83634)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Мари-Турек",operator:"",desc:""},{mask:"+7(83635)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Морки",operator:"",desc:""},{mask:"+7(83636)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Новый Торъял",operator:"",desc:""},{mask:"+7(83637)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Куженер",operator:"",desc:""},{mask:"+7(83638)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Советский",operator:"",desc:""},{mask:"+7(83639)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Параньга",operator:"",desc:""},{mask:"+7(83641)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Оршанка",operator:"",desc:""},{mask:"+7(83643)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Килемары",operator:"",desc:""},{mask:"+7(83644)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Юрино",operator:"",desc:""},{mask:"+7(83645)#-##-##",cc:"RU",cd:"Russia",region:"Марий Эл",city:"Звенигово",operator:"",desc:""},{mask:"+7(840)###-##-##",cc:"RU",cd:"Russia",region:"Абхазия",city:"",operator:"",desc:""},{mask:"+7(840)22#-##-##",cc:"RU",cd:"Russia",region:"Абхазия",city:"Сухум",operator:"",desc:""},{mask:"+7(840)23#-##-##",cc:"RU",cd:"Russia",region:"Абхазия",city:"Гагра",operator:"",desc:""},{mask:"+7(840)24#-##-##",cc:"RU",cd:"Russia",region:"Абхазия",city:"Гудаута",operator:"",desc:""},{mask:"+7(840)25#-##-##",cc:"RU",cd:"Russia",region:"Абхазия",city:"Очамчыра",operator:"",desc:""},{mask:"+7(840)26#-##-##",cc:"RU",cd:"Russia",region:"Абхазия",city:"Ткуарчал",operator:"",desc:""},{mask:"+7(840)27#-##-##",cc:"RU",cd:"Russia",region:"Абхазия",city:"Гулрыпш",operator:"",desc:""},{mask:"+7(840)28#-##-##",cc:"RU",cd:"Russia",region:"Абхазия",city:"Гал",operator:"",desc:""},{mask:"+7(841)###-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"",operator:"",desc:""},{mask:"+7(8412)##-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Пенза",operator:"",desc:""},{mask:"+7(84140)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Бессоновка",operator:"",desc:""},{mask:"+7(84141)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Беково",operator:"",desc:""},{mask:"+7(84142)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Вадинск",operator:"",desc:""},{mask:"+7(84143)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Башмаково",operator:"",desc:""},{mask:"+7(84144)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Исса",operator:"",desc:""},{mask:"+7(84145)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Русский Камешкир",operator:"",desc:""},{mask:"+7(84146)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Колышлей",operator:"",desc:""},{mask:"+7(84147)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Кондоль",operator:"",desc:""},{mask:"+7(84148)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Лопатино",operator:"",desc:""},{mask:"+7(84150)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Мокшан",operator:"",desc:""},{mask:"+7(84151)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Спасск",operator:"",desc:""},{mask:"+7(84152)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Пачелма",operator:"",desc:""},{mask:"+7(84153)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Белинский",operator:"",desc:""},{mask:"+7(84154)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Нижний Ломов",operator:"",desc:""},{mask:"+7(84155)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Земетчино",operator:"",desc:""},{mask:"+7(84156)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Каменка",operator:"",desc:""},{mask:"+7(84157)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Кузнецк",operator:"",desc:""},{mask:"+7(84158)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Городище",operator:"",desc:""},{mask:"+7(84159)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Шемышейка",operator:"",desc:""},{mask:"+7(84161)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Лунино",operator:"",desc:""},{mask:"+7(84162)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Малая Сердоба",operator:"",desc:""},{mask:"+7(84163)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Наровчат",operator:"",desc:""},{mask:"+7(84164)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Неверкино",operator:"",desc:""},{mask:"+7(84165)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Никольск",operator:"",desc:""},{mask:"+7(84167)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Сердобск",operator:"",desc:""},{mask:"+7(84168)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Сосновоборск",operator:"",desc:""},{mask:"+7(84169)#-##-##",cc:"RU",cd:"Russia",region:"Пензенская область",city:"Тамала",operator:"",desc:""},{mask:"+7(842)###-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"",operator:"",desc:""},{mask:"+7(8422)##-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Ульяновск",operator:"",desc:""},{mask:"+7(84230)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Старая Майна",operator:"",desc:""},{mask:"+7(84231)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Чердаклы",operator:"",desc:""},{mask:"+7(84232)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Новая Малыкла",operator:"",desc:""},{mask:"+7(84233)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Сенгилей",operator:"",desc:""},{mask:"+7(84234)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Тереньга",operator:"",desc:""},{mask:"+7(84235)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Димитровград",operator:"",desc:""},{mask:"+7(84237)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Кузоватово",operator:"",desc:""},{mask:"+7(84238)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Новоспасское",operator:"",desc:""},{mask:"+7(84239)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Радищево",operator:"",desc:""},{mask:"+7(84240)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Базарный Сызган",operator:"",desc:""},{mask:"+7(84241)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Инза",operator:"",desc:""},{mask:"+7(84242)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Сурское",operator:"",desc:""},{mask:"+7(84243)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Вешкайма",operator:"",desc:""},{mask:"+7(84244)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Майна",operator:"",desc:""},{mask:"+7(84245)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Большое Нагаткино",operator:"",desc:""},{mask:"+7(84246)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Карсун",operator:"",desc:""},{mask:"+7(84247)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Николаевка",operator:"",desc:""},{mask:"+7(84248)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Павловка",operator:"",desc:""},{mask:"+7(84249)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Старая Кулатка",operator:"",desc:""},{mask:"+7(84253)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Барыш",operator:"",desc:""},{mask:"+7(84254)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Ишеевка",operator:"",desc:""},{mask:"+7(84255)#-##-##",cc:"RU",cd:"Russia",region:"Ульяновская область",city:"Новоульяновск",operator:"",desc:""},{mask:"+7(843)###-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Казань",operator:"",desc:""},{mask:"+7(84341)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Алексеевское",operator:"",desc:""},{mask:"+7(84342)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Чистополь",operator:"",desc:""},{mask:"+7(84344)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Аксубаево",operator:"",desc:""},{mask:"+7(84345)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Нурлат",operator:"",desc:""},{mask:"+7(84346)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Базарные Матаки",operator:"",desc:""},{mask:"+7(84347)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Болгар",operator:"",desc:""},{mask:"+7(84348)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Новошешминск",operator:"",desc:""},{mask:"+7(84360)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Тюлячи",operator:"",desc:""},{mask:"+7(84361)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Рыбная Слобода",operator:"",desc:""},{mask:"+7(84362)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Богатые Сабы",operator:"",desc:""},{mask:"+7(84364)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Кукмор",operator:"",desc:""},{mask:"+7(84365)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Высокая Гора",operator:"",desc:""},{mask:"+7(84366)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Арск",operator:"",desc:""},{mask:"+7(84367)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Пестрецы",operator:"",desc:""},{mask:"+7(84368)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Балтаси",operator:"",desc:""},{mask:"+7(84369)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Большая Атня",operator:"",desc:""},{mask:"+7(84370)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Большие Кайбицы",operator:"",desc:""},{mask:"+7(84371)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Зеленодольск",operator:"",desc:""},{mask:"+7(84373)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Тетюши",operator:"",desc:""},{mask:"+7(84374)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Буинск",operator:"",desc:""},{mask:"+7(84375)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Старое Дрожжаное",operator:"",desc:""},{mask:"+7(84376)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Апастово",operator:"",desc:""},{mask:"+7(84377)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Камское Устье",operator:"",desc:""},{mask:"+7(84378)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Лаишево",operator:"",desc:""},{mask:"+7(84379)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Верхний Услон",operator:"",desc:""},{mask:"+7(84396)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Черемшан",operator:"",desc:""},{mask:"+7(844)###-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"",operator:"",desc:""},{mask:"+7(844)2##-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Волгоград",operator:"",desc:""},{mask:"+7(844)70#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Волгоград",operator:"",desc:""},{mask:"+7(8443)##-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Волжский",operator:"",desc:""},{mask:"+7(84442)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Урюпинск",operator:"",desc:""},{mask:"+7(84443)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Нехаевская",operator:"",desc:""},{mask:"+7(84444)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Новониколаевский",operator:"",desc:""},{mask:"+7(84445)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Преображенская",operator:"",desc:""},{mask:"+7(84446)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Алексеевская",operator:"",desc:""},{mask:"+7(84447)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Новоаннинский",operator:"",desc:""},{mask:"+7(84452)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Елань",operator:"",desc:""},{mask:"+7(84453)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Рудня",operator:"",desc:""},{mask:"+7(84454)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Жирновск",operator:"",desc:""},{mask:"+7(84455)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Котово",operator:"",desc:""},{mask:"+7(84456)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Ольховка",operator:"",desc:""},{mask:"+7(84457)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Камышин",operator:"",desc:""},{mask:"+7(84458)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Дубовка",operator:"",desc:""},{mask:"+7(84461)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Даниловка",operator:"",desc:""},{mask:"+7(84462)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Кумылженская",operator:"",desc:""},{mask:"+7(84463)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Михайловка",operator:"",desc:""},{mask:"+7(84464)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Серафимович",operator:"",desc:""},{mask:"+7(84465)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Фролово",operator:"",desc:""},{mask:"+7(84466)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Клетская",operator:"",desc:""},{mask:"+7(84467)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Иловля",operator:"",desc:""},{mask:"+7(84468)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Городище",operator:"",desc:""},{mask:"+7(84472)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Калач-на-Дону",operator:"",desc:""},{mask:"+7(84473)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Суровикино",operator:"",desc:""},{mask:"+7(84474)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Чернышковский",operator:"",desc:""},{mask:"+7(84475)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Октябрьский",operator:"",desc:""},{mask:"+7(84476)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Котельниково",operator:"",desc:""},{mask:"+7(84477)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Светлый Яр",operator:"",desc:""},{mask:"+7(84478)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Ленинск",operator:"",desc:""},{mask:"+7(84479)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Средняя Ахтуба",operator:"",desc:""},{mask:"+7(84492)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Палласовка",operator:"",desc:""},{mask:"+7(84493)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Старая Полтавка",operator:"",desc:""},{mask:"+7(84494)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Николаевск",operator:"",desc:""},{mask:"+7(84495)#-##-##",cc:"RU",cd:"Russia",region:"Волгоградская область",city:"Быково",operator:"",desc:""},{mask:"+7(845)###-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"",operator:"",desc:""},{mask:"+7(8452)##-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Саратов",operator:"",desc:""},{mask:"+7(8453)2#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Балаково",operator:"",desc:""},{mask:"+7(8453)3#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Балаково",operator:"",desc:""},{mask:"+7(8453)4#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Балаково",operator:"",desc:""},{mask:"+7(8453)5#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Энгельс",operator:"",desc:""},{mask:"+7(8453)7#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Энгельс",operator:"",desc:""},{mask:"+7(8453)9#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Энгельс",operator:"",desc:""},{mask:"+7(84540)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Ртищево",operator:"",desc:""},{mask:"+7(84542)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Аркадак",operator:"",desc:""},{mask:"+7(84543)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Турки",operator:"",desc:""},{mask:"+7(84544)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Романовка",operator:"",desc:""},{mask:"+7(84545)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Балашов",operator:"",desc:""},{mask:"+7(84548)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Самойловка",operator:"",desc:""},{mask:"+7(84549)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Калининск",operator:"",desc:""},{mask:"+7(84550)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Красноармейск",operator:"",desc:""},{mask:"+7(84551)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Лысые Горы",operator:"",desc:""},{mask:"+7(84552)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Аткарск",operator:"",desc:""},{mask:"+7(84554)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Екатериновка",operator:"",desc:""},{mask:"+7(84555)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Петровск",operator:"",desc:""},{mask:"+7(84557)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Новые Бурасы",operator:"",desc:""},{mask:"+7(84558)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Татищево",operator:"",desc:""},{mask:"+7(84560)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Красный Кут",operator:"",desc:""},{mask:"+7(84561)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Питерка",operator:"",desc:""},{mask:"+7(84562)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Новоузенск",operator:"",desc:""},{mask:"+7(84563)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Дергачи",operator:"",desc:""},{mask:"+7(84564)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Ершов",operator:"",desc:""},{mask:"+7(84565)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Мокроус",operator:"",desc:""},{mask:"+7(84566)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Степное",operator:"",desc:""},{mask:"+7(84567)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Маркс",operator:"",desc:""},{mask:"+7(84568)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Воскресенское",operator:"",desc:""},{mask:"+7(84573)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Духовницкое",operator:"",desc:""},{mask:"+7(84574)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Пугачёв",operator:"",desc:""},{mask:"+7(84575)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Перелюб",operator:"",desc:""},{mask:"+7(84576)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Озинки",operator:"",desc:""},{mask:"+7(84577)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Горный",operator:"",desc:""},{mask:"+7(84578)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Александров Гай",operator:"",desc:""},{mask:"+7(84579)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Ивантеевка",operator:"",desc:""},{mask:"+7(84591)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Базарный Карабулак",operator:"",desc:""},{mask:"+7(84592)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Балтай",operator:"",desc:""},{mask:"+7(84593)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Вольск",operator:"",desc:""},{mask:"+7(84595)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Хвалынск",operator:"",desc:""},{mask:"+7(84596)#-##-##",cc:"RU",cd:"Russia",region:"Саратовская область",city:"Ровное",operator:"",desc:""},{mask:"+7(846)###-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"",operator:"",desc:""},{mask:"+7(846)2##-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Самара",operator:"",desc:""},{mask:"+7(846)300-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Самара",operator:"",desc:""},{mask:"+7(846)302-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Самара",operator:"",desc:""},{mask:"+7(846)303-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Самара",operator:"",desc:""},{mask:"+7(846)309-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Самара",operator:"",desc:""},{mask:"+7(846)31#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Самара",operator:"",desc:""},{mask:"+7(846)33#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Самара",operator:"",desc:""},{mask:"+7(846)34#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Самара",operator:"",desc:""},{mask:"+7(846)37#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Самара",operator:"",desc:""},{mask:"+7(846)9##-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Самара",operator:"",desc:""},{mask:"+7(84630)5-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Волжский Утёс",operator:"",desc:""},{mask:"+7(84635)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Новокуйбышевск",operator:"",desc:""},{mask:"+7(84639)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Чапаевск",operator:"",desc:""},{mask:"+7(8464)3#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Сызрань",operator:"",desc:""},{mask:"+7(8464)4#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Сызрань",operator:"",desc:""},{mask:"+7(8464)9#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Сызрань",operator:"",desc:""},{mask:"+7(84646)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Октябрьск",operator:"",desc:""},{mask:"+7(84647)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Приволжье",operator:"",desc:""},{mask:"+7(84648)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Шигоны",operator:"",desc:""},{mask:"+7(84650)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Кошки",operator:"",desc:""},{mask:"+7(84651)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Челно-Вершины",operator:"",desc:""},{mask:"+7(84652)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Шентала",operator:"",desc:""},{mask:"+7(84653)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Клявлино",operator:"",desc:""},{mask:"+7(84654)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Исаклы",operator:"",desc:""},{mask:"+7(84655)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Сергиевск",operator:"",desc:""},{mask:"+7(84656)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Похвистнево",operator:"",desc:""},{mask:"+7(84657)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Красный Яр",operator:"",desc:""},{mask:"+7(84658)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Елховка",operator:"",desc:""},{mask:"+7(84660)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Кинель-Черкассы",operator:"",desc:""},{mask:"+7(84661)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Отрадный",operator:"",desc:""},{mask:"+7(84663)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Кинель",operator:"",desc:""},{mask:"+7(84664)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Камышла",operator:"",desc:""},{mask:"+7(84666)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Богатое",operator:"",desc:""},{mask:"+7(84667)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Борское",operator:"",desc:""},{mask:"+7(84670)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Нефтегорск",operator:"",desc:""},{mask:"+7(84671)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Алексеевка",operator:"",desc:""},{mask:"+7(84672)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Большая Черниговка",operator:"",desc:""},{mask:"+7(84673)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Большая Глушица",operator:"",desc:""},{mask:"+7(84674)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Пестравка",operator:"",desc:""},{mask:"+7(84675)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Красноармейское",operator:"",desc:""},{mask:"+7(84676)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Безенчук",operator:"",desc:""},{mask:"+7(84677)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Хворостянка",operator:"",desc:""},{mask:"+7(847)###-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"",operator:"",desc:""},{mask:"+7(84722)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Элиста",operator:"",desc:""},{mask:"+7(84731)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Городовиковск",operator:"",desc:""},{mask:"+7(84732)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Ики-Бурул",operator:"",desc:""},{mask:"+7(84733)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Лагань",operator:"",desc:""},{mask:"+7(84734)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Малые Дербеты",operator:"",desc:""},{mask:"+7(84735)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Кетченеры",operator:"",desc:""},{mask:"+7(84736)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Приютное",operator:"",desc:""},{mask:"+7(84741)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Садовое",operator:"",desc:""},{mask:"+7(84742)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Троицкое",operator:"",desc:""},{mask:"+7(84743)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Комсомольский",operator:"",desc:""},{mask:"+7(84744)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Цаган Аман",operator:"",desc:""},{mask:"+7(84745)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Яшалта",operator:"",desc:""},{mask:"+7(84746)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Яшкуль",operator:"",desc:""},{mask:"+7(84747)#-##-##",cc:"RU",cd:"Russia",region:"Калмыкия",city:"Большой Царын",operator:"",desc:""},{mask:"+7(848)###-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"",operator:"",desc:""},{mask:"+7(8482)##-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Тольятти",operator:"",desc:""},{mask:"+7(84862)#-##-##",cc:"RU",cd:"Russia",region:"Самарская область",city:"Жигулевск",operator:"",desc:""},{mask:"+7(851)###-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"",operator:"",desc:""},{mask:"+7(8512)##-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Астрахань",operator:"",desc:""},{mask:"+7(85140)#-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Знаменск",operator:"",desc:""},{mask:"+7(85141)#-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Ахтубинск",operator:"",desc:""},{mask:"+7(85142)#-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Володарский",operator:"",desc:""},{mask:"+7(85143)#-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Енотаевка",operator:"",desc:""},{mask:"+7(85144)#-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Икряное",operator:"",desc:""},{mask:"+7(85145)#-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Камызяк",operator:"",desc:""},{mask:"+7(85146)#-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Красный Яр",operator:"",desc:""},{mask:"+7(85147)#-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Лиман",operator:"",desc:""},{mask:"+7(85148)#-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Харабали",operator:"",desc:""},{mask:"+7(85149)#-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Чёрный Яр",operator:"",desc:""},{mask:"+7(85171)#-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Нариманов",operator:"",desc:""},{mask:"+7(85172)#-##-##",cc:"RU",cd:"Russia",region:"Астраханская область",city:"Началово",operator:"",desc:""},{mask:"+7(855)###-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"",operator:"",desc:""},{mask:"+7(8552)##-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Набережные Челны",operator:"",desc:""},{mask:"+7(8553)##-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Альметьевск",operator:"",desc:""},{mask:"+7(85549)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Менделеевск",operator:"",desc:""},{mask:"+7(8555)3#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Нижнекамск",operator:"",desc:""},{mask:"+7(8555)4#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Нижнекамск",operator:"",desc:""},{mask:"+7(85551)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Агрыз",operator:"",desc:""},{mask:"+7(85552)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Актаныш",operator:"",desc:""},{mask:"+7(85555)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Мензелинск",operator:"",desc:""},{mask:"+7(85556)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Муслюмово",operator:"",desc:""},{mask:"+7(85557)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Елабуга",operator:"",desc:""},{mask:"+7(85558)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Заинск",operator:"",desc:""},{mask:"+7(85559)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Сарманово",operator:"",desc:""},{mask:"+7(85563)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Мамадыш",operator:"",desc:""},{mask:"+7(85569)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Бавлы",operator:"",desc:""},{mask:"+7(8557)2#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Набережные Челны",operator:"",desc:""},{mask:"+7(8557)3#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Набережные Челны",operator:"",desc:""},{mask:"+7(85592)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Азнакаево",operator:"",desc:""},{mask:"+7(85593)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Уруссу",operator:"",desc:""},{mask:"+7(85594)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Бугульма",operator:"",desc:""},{mask:"+7(85595)#-##-##",cc:"RU",cd:"Russia",region:"Татарстан",city:"Лениногорск",operator:"",desc:""},{mask:"+7(861)###-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Краснодар",operator:"",desc:""},{mask:"+7(86130)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Тимашёвск",operator:"",desc:""},{mask:"+7(86131)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Крымск",operator:"",desc:""},{mask:"+7(86132)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Ейск",operator:"",desc:""},{mask:"+7(86133)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Анапа",operator:"",desc:""},{mask:"+7(86135)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Усть-Лабинск",operator:"",desc:""},{mask:"+7(86137)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Армавир",operator:"",desc:""},{mask:"+7(86138)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Кропоткин",operator:"",desc:""},{mask:"+7(86140)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Успенское",operator:"",desc:""},{mask:"+7(86141)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Геленджик",operator:"",desc:""},{mask:"+7(86142)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Кореновск",operator:"",desc:""},{mask:"+7(86143)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Приморско-Ахтарск",operator:"",desc:""},{mask:"+7(86144)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Отрадная",operator:"",desc:""},{mask:"+7(86145)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Ленинградская",operator:"",desc:""},{mask:"+7(86146)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Славянск-на-Кубани",operator:"",desc:""},{mask:"+7(86147)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Курганинск",operator:"",desc:""},{mask:"+7(86148)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Темрюк",operator:"",desc:""},{mask:"+7(86149)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Новопокровская",operator:"",desc:""},{mask:"+7(86150)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Абинск",operator:"",desc:""},{mask:"+7(86151)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Старощербиновская",operator:"",desc:""},{mask:"+7(86152)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Апшеронск",operator:"",desc:""},{mask:"+7(86153)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Староминская",operator:"",desc:""},{mask:"+7(86154)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Белая Глина",operator:"",desc:""},{mask:"+7(86155)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Белореченск",operator:"",desc:""},{mask:"+7(86156)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Брюховецкая",operator:"",desc:""},{mask:"+7(86157)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Выселки",operator:"",desc:""},{mask:"+7(86158)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Тбилисская",operator:"",desc:""},{mask:"+7(86159)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Горячий Ключ",operator:"",desc:""},{mask:"+7(86160)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Гулькевичи",operator:"",desc:""},{mask:"+7(86161)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Крыловская",operator:"",desc:""},{mask:"+7(86162)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Динская",operator:"",desc:""},{mask:"+7(86163)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Калининская",operator:"",desc:""},{mask:"+7(86164)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Каневская",operator:"",desc:""},{mask:"+7(86165)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Полтавская",operator:"",desc:""},{mask:"+7(86166)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Северская",operator:"",desc:""},{mask:"+7(86167)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Туапсе",operator:"",desc:""},{mask:"+7(86168)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Кущёвская",operator:"",desc:""},{mask:"+7(86169)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Лабинск",operator:"",desc:""},{mask:"+7(8617)##-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Новороссийск",operator:"",desc:""},{mask:"+7(86191)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Павловская",operator:"",desc:""},{mask:"+7(86192)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Мостовской",operator:"",desc:""},{mask:"+7(86193)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Кавказская",operator:"",desc:""},{mask:"+7(86195)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Новокубанск",operator:"",desc:""},{mask:"+7(86196)#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Тихорецк",operator:"",desc:""},{mask:"+7(862)###-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"",operator:"",desc:"агломерация Большой Сочи"},{mask:"+7(862)2##-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:["Аше","Вардане","Головинка","Головинка","Сочи","Хоста"],operator:"",desc:"агломерация Большой Сочи"},{mask:"+7(862)23#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"",operator:"МТС",desc:"агломерация Большой Сочи"},{mask:"+7(862)24#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Адлер",operator:"",desc:"агломерация Большой Сочи"},{mask:"+7(862)247-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Кудепста",operator:"",desc:"агломерация Большой Сочи"},{mask:"+7(862)252-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:["Дагомыс","Лоо"],operator:"",desc:"агломерация Большой Сочи"},{mask:"+7(862)27#-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"Лазаревское",operator:"",desc:"агломерация Большой Сочи"},{mask:"+7(862)295-##-##",cc:"RU",cd:"Russia",region:"Краснодарский край",city:"",operator:"МегаФон",desc:"агломерация Большой Сочи"},{mask:"+7(863)###-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"",operator:"",desc:""},{mask:"+7(863)2##-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Ростов-на-Дону",operator:"",desc:""},{mask:"+7(863)3##-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Ростов-на-Дону",operator:"",desc:""},{mask:"+7(8634)3#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Таганрог",operator:"",desc:""},{mask:"+7(8634)43-1#-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Таганрог",operator:"",desc:""},{mask:"+7(8634)6#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Таганрог",operator:"",desc:""},{mask:"+7(86340)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Родионово-Несветайская",operator:"",desc:""},{mask:"+7(86341)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Матвеев-Курган",operator:"",desc:""},{mask:"+7(86342)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Азов",operator:"",desc:""},{mask:"+7(86345)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Кагальницкая",operator:"",desc:""},{mask:"+7(86347)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Покровское",operator:"",desc:""},{mask:"+7(86348)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Куйбышево",operator:"",desc:""},{mask:"+7(86349)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Чалтырь",operator:"",desc:""},{mask:"+7(8635)2#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Новочеркасск",operator:"",desc:""},{mask:"+7(86350)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Аксай",operator:"",desc:""},{mask:"+7(86351)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Усть-Донецкий",operator:"",desc:""},{mask:"+7(86353)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Вёшенская",operator:"",desc:""},{mask:"+7(86354)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Батайск",operator:"",desc:""},{mask:"+7(86355)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Зверево",operator:"",desc:""},{mask:"+7(86356)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Семикаракорск",operator:"",desc:""},{mask:"+7(86357)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Багаевская",operator:"",desc:""},{mask:"+7(86358)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Весёлый",operator:"",desc:""},{mask:"+7(86359)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Зерноград",operator:"",desc:""},{mask:"+7(8636)2#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Шахты",operator:"",desc:""},{mask:"+7(86360)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Каменоломни",operator:"",desc:""},{mask:"+7(86361)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Гуково",operator:"",desc:""},{mask:"+7(86363)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Советская",operator:"",desc:""},{mask:"+7(86364)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Казанская",operator:"",desc:""},{mask:"+7(86365)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Каменск-Шахтинский",operator:"",desc:""},{mask:"+7(86367)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Красный Сулин",operator:"",desc:""},{mask:"+7(86368)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Донецк",operator:"",desc:""},{mask:"+7(86369)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Новошахтинск",operator:"",desc:""},{mask:"+7(86370)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Егорлыкская",operator:"",desc:""},{mask:"+7(86371)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Целина",operator:"",desc:""},{mask:"+7(86372)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Сальск",operator:"",desc:""},{mask:"+7(86373)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Песчанокопское",operator:"",desc:""},{mask:"+7(86374)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Пролетарск",operator:"",desc:""},{mask:"+7(86375)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Орловский",operator:"",desc:""},{mask:"+7(86376)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Зимовники",operator:"",desc:""},{mask:"+7(86377)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Дубовское",operator:"",desc:""},{mask:"+7(86378)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Заветное",operator:"",desc:""},{mask:"+7(86379)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Ремонтное",operator:"",desc:""},{mask:"+7(86382)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Боковская",operator:"",desc:""},{mask:"+7(86383)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Белая Калитва",operator:"",desc:""},{mask:"+7(86384)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Морозовск",operator:"",desc:""},{mask:"+7(86385)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Миллерово",operator:"",desc:""},{mask:"+7(86386)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Тарасовский",operator:"",desc:""},{mask:"+7(86387)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Чертково",operator:"",desc:""},{mask:"+7(86388)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Кашары",operator:"",desc:""},{mask:"+7(86389)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Милютинская",operator:"",desc:""},{mask:"+7(8639)2#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Волгодонск",operator:"",desc:""},{mask:"+7(86391)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Цимлянск",operator:"",desc:""},{mask:"+7(86393)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Константиновск",operator:"",desc:""},{mask:"+7(86394)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Романовская",operator:"",desc:""},{mask:"+7(86395)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Большая Мартыновка",operator:"",desc:""},{mask:"+7(86396)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Обливская",operator:"",desc:""},{mask:"+7(86397)#-##-##",cc:"RU",cd:"Russia",region:"Ростовская область",city:"Тацинская",operator:"",desc:""},{mask:"+7(865)###-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"",operator:"",desc:""},{mask:"+7(8652)##-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Ставрополь",operator:"",desc:""},{mask:"+7(86540)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Грачёвка",operator:"",desc:""},{mask:"+7(86541)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Красногвардейское",operator:"",desc:""},{mask:"+7(86542)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Ипатово",operator:"",desc:""},{mask:"+7(86543)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Левокумское",operator:"",desc:""},{mask:"+7(86544)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Новоалександровск",operator:"",desc:""},{mask:"+7(86545)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Изобильный",operator:"",desc:""},{mask:"+7(86546)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Донское",operator:"",desc:""},{mask:"+7(86547)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Светлоград",operator:"",desc:""},{mask:"+7(86548)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Новоселицкое",operator:"",desc:""},{mask:"+7(86549)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Благодарный",operator:"",desc:""},{mask:"+7(86550)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Кочубеевское",operator:"",desc:""},{mask:"+7(86552)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Зеленокумск",operator:"",desc:""},{mask:"+7(86553)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Михайловск",operator:"",desc:""},{mask:"+7(86554)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Невинномысск",operator:"",desc:""},{mask:"+7(86555)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Дивное",operator:"",desc:""},{mask:"+7(86556)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Курсавка",operator:"",desc:""},{mask:"+7(86557)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Александровское",operator:"",desc:""},{mask:"+7(86558)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Нефтекумск",operator:"",desc:""},{mask:"+7(86559)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Буденновск",operator:"",desc:""},{mask:"+7(86560)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Арзгир",operator:"",desc:""},{mask:"+7(86563)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Степное",operator:"",desc:""},{mask:"+7(86565)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Летняя Ставка",operator:"",desc:""},{mask:"+7(866)###-##-##",cc:"RU",cd:"Russia",region:"Кабардино-Балкария",city:"",operator:"",desc:""},{mask:"+7(8662)##-##-##",cc:"RU",cd:"Russia",region:"Кабардино-Балкария",city:"Нальчик",operator:"",desc:""},{mask:"+7(86630)#-##-##",cc:"RU",cd:"Russia",region:"Кабардино-Балкария",city:"Чегем",operator:"",desc:""},{mask:"+7(86631)#-##-##",cc:"RU",cd:"Russia",region:"Кабардино-Балкария",city:"Прохладный",operator:"",desc:""},{mask:"+7(86632)#-##-##",cc:"RU",cd:"Russia",region:"Кабардино-Балкария",city:"Терек",operator:"",desc:""},{mask:"+7(86633)#-##-##",cc:"RU",cd:"Russia",region:"Кабардино-Балкария",city:"Майский",operator:"",desc:""},{mask:"+7(86634)#-##-##",cc:"RU",cd:"Russia",region:"Кабардино-Балкария",city:"Баксан",operator:"",desc:""},{mask:"+7(86635)#-##-##",cc:"RU",cd:"Russia",region:"Кабардино-Балкария",city:"Нарткала",operator:"",desc:""},{mask:"+7(86636)#-##-##",cc:"RU",cd:"Russia",region:"Кабардино-Балкария",city:"Кашхатау",operator:"",desc:""},{mask:"+7(86637)#-##-##",cc:"RU",cd:"Russia",region:"Кабардино-Балкария",city:"Залукокоаже",operator:"",desc:""},{mask:"+7(86638)#-##-##",cc:"RU",cd:"Russia",region:"Кабардино-Балкария",city:"Тырныауз",operator:"",desc:""},{mask:"+7(867)###-##-##",cc:"RU",cd:"Russia",region:"Северная Осетия",city:"",operator:"",desc:""},{mask:"+7(8672)##-##-##",cc:"RU",cd:"Russia",region:"Северная Осетия",city:"Владикавказ",operator:"",desc:""},{mask:"+7(86731)#-##-##",cc:"RU",cd:"Russia",region:"Северная Осетия",city:"Алагир",operator:"",desc:""},{mask:"+7(86732)#-##-##",cc:"RU",cd:"Russia",region:"Северная Осетия",city:"Ардон",operator:"",desc:""},{mask:"+7(86733)#-##-##",cc:"RU",cd:"Russia",region:"Северная Осетия",city:"Дигора",operator:"",desc:""},{mask:"+7(86734)#-##-##",cc:"RU",cd:"Russia",region:"Северная Осетия",city:"Чикола",operator:"",desc:""},{mask:"+7(86735)#-##-##",cc:"RU",cd:"Russia",region:"Северная Осетия",city:"Эльхотово",operator:"",desc:""},{mask:"+7(86736)#-##-##",cc:"RU",cd:"Russia",region:"Северная Осетия",city:"Моздок",operator:"",desc:""},{mask:"+7(86737)#-##-##",cc:"RU",cd:"Russia",region:"Северная Осетия",city:"Беслан",operator:"",desc:""},{mask:"+7(86738)#-##-##",cc:"RU",cd:"Russia",region:"Северная Осетия",city:"Октябрьское",operator:"",desc:""},{mask:"+7(86739)#-##-##",cc:"RU",cd:"Russia",region:"Северная Осетия",city:"Архонская",operator:"",desc:""},{mask:"+7(871)###-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"",operator:"",desc:""},{mask:"+7(8712)##-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Грозный",operator:"",desc:""},{mask:"+7(87132)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Знаменское",operator:"",desc:""},{mask:"+7(87134)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Ведено",operator:"",desc:""},{mask:"+7(87135)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Шатой",operator:"",desc:""},{mask:"+7(87136)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Шелковская",operator:"",desc:""},{mask:"+7(87142)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Ачхой-Мартан",operator:"",desc:""},{mask:"+7(87143)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Наурская",operator:"",desc:""},{mask:"+7(87145)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Урус-Мартан",operator:"",desc:""},{mask:"+7(87146)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Шали",operator:"",desc:""},{mask:"+7(87147)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Аргун",operator:"",desc:""},{mask:"+7(87148)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Ножай-Юрт",operator:"",desc:""},{mask:"+7(87152)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Гудермес",operator:"",desc:""},{mask:"+7(87154)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Серноводск",operator:"",desc:""},{mask:"+7(87155)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Курчалой",operator:"",desc:""},{mask:"+7(87156)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:["Толстой-Юрт","Старые Атаги"],operator:"",desc:""},{mask:"+7(87164)#-##-##",cc:"RU",cd:"Russia",region:"Чеченская Республика",city:"Итум-Кале",operator:"",desc:""},{mask:"+7(872)###-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"",operator:"",desc:""},{mask:"+7(8722)##-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Махачкала",operator:"",desc:""},{mask:"+7(87230)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Сергокала",operator:"",desc:""},{mask:"+7(87231)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Хасавюрт",operator:"",desc:""},{mask:"+7(87232)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Карабудахкент",operator:"",desc:""},{mask:"+7(87233)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Хунзах",operator:"",desc:""},{mask:"+7(87234)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Кизилюрт",operator:"",desc:""},{mask:"+7(87235)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Магарамкент",operator:"",desc:""},{mask:"+7(87236)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Касумкент",operator:"",desc:""},{mask:"+7(87237)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Буйнакск",operator:"",desc:""},{mask:"+7(87238)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Маджалис",operator:"",desc:""},{mask:"+7(87239)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Кизляр",operator:"",desc:""},{mask:"+7(87240)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Дербент",operator:"",desc:""},{mask:"+7(87242)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Новолакское",operator:"",desc:""},{mask:"+7(87243)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:["Тпиг","Агул"],operator:"",desc:""},{mask:"+7(87244)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Хив",operator:"",desc:""},{mask:"+7(87245)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Избербаш",operator:"",desc:""},{mask:"+7(87246)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Каспийск",operator:"",desc:""},{mask:"+7(87247)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Бабаюрт",operator:"",desc:""},{mask:"+7(87248)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Новокаякент",operator:"",desc:""},{mask:"+7(87249)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Хучни",operator:"",desc:""},{mask:"+7(87252)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Леваши",operator:"",desc:""},{mask:"+7(87254)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Уркарах",operator:"",desc:""},{mask:"+7(87255)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Гергебиль",operator:"",desc:""},{mask:"+7(87256)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Терекли-Мектеб",operator:"",desc:""},{mask:"+7(87257)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Унцукуль",operator:"",desc:""},{mask:"+7(87258)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Гуниб",operator:"",desc:""},{mask:"+7(87259)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Хебда",operator:"",desc:""},{mask:"+7(87260)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Акуша",operator:"",desc:""},{mask:"+7(87261)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Тарумовка",operator:"",desc:""},{mask:"+7(87262)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Курах",operator:"",desc:""},{mask:"+7(87263)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Ахты",operator:"",desc:""},{mask:"+7(87264)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Рутул",operator:"",desc:""},{mask:"+7(87265)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Тлярата",operator:"",desc:""},{mask:"+7(87266)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Цуриб",operator:"",desc:""},{mask:"+7(87267)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Кумух",operator:"",desc:""},{mask:"+7(87268)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Вачи",operator:"",desc:""},{mask:"+7(87271)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Ботлих",operator:"",desc:""},{mask:"+7(87272)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Мехельта",operator:"",desc:""},{mask:"+7(87273)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Агвали",operator:"",desc:""},{mask:"+7(87274)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Бежта",operator:"",desc:""},{mask:"+7(87275)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Дагестанские Огни",operator:"",desc:""},{mask:"+7(87276)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Южно-Сухокумск",operator:"",desc:""},{mask:"+7(87279)#-##-##",cc:"RU",cd:"Russia",region:"Республика Дагестан",city:"Дылым",operator:"",desc:""},{mask:"+7(873)###-##-##",cc:"RU",cd:"Russia",region:"Республика Ингушетия",city:"",operator:"",desc:""},{mask:"+7(8732)##-##-##",cc:"RU",cd:"Russia",region:"Республика Ингушетия",city:"Назрань",operator:"",desc:""},{mask:"+7(87341)#-##-##",cc:"RU",cd:"Russia",region:"Республика Ингушетия",city:"Орджоникидзевская",operator:"",desc:""},{mask:"+7(87342)#-##-##",cc:"RU",cd:"Russia",region:"Республика Ингушетия",city:"Малгобек",operator:"",desc:""},{mask:"+7(87343)#-##-##",cc:"RU",cd:"Russia",region:"Республика Ингушетия",city:"Джейрах",operator:"",desc:""},{mask:"+7(87344)#-##-##",cc:"RU",cd:"Russia",region:"Республика Ингушетия",city:"Карабулак",operator:"",desc:""},{mask:"+7(87345)#-##-##",cc:"RU",cd:"Russia",region:"Республика Ингушетия",city:"Магас",operator:"",desc:""},{mask:"+7(877)###-##-##",cc:"RU",cd:"Russia",region:"Республика Адыгея",city:"",operator:"",desc:""},{mask:"+7(8772)##-##-##",cc:"RU",cd:"Russia",region:"Республика Адыгея",city:"Майкоп",operator:"",desc:""},{mask:"+7(87770)#-##-##",cc:"RU",cd:"Russia",region:"Республика Адыгея",city:"Кошехабль",operator:"",desc:""},{mask:"+7(87771)#-##-##",cc:"RU",cd:"Russia",region:"Республика Адыгея",city:"Тахтамукай",operator:"",desc:""},{mask:"+7(87772)#-##-##",cc:"RU",cd:"Russia",region:"Республика Адыгея",city:"Адыгейск",operator:"",desc:""},{mask:"+7(87773)#-##-##",cc:"RU",cd:"Russia",region:"Республика Адыгея",city:"Хакуринохабль",operator:"",desc:""},{mask:"+7(87777)#-##-##",cc:"RU",cd:"Russia",region:"Республика Адыгея",city:"Тульский",operator:"",desc:""},{mask:"+7(87778)#-##-##",cc:"RU",cd:"Russia",region:"Республика Адыгея",city:"Красногвардейское",operator:"",desc:""},{mask:"+7(87779)#-##-##",cc:"RU",cd:"Russia",region:"Республика Адыгея",city:"Гиагинская",operator:"",desc:""},{mask:"+7(878)###-##-##",cc:"RU",cd:"Russia",region:"Республика Карачаево-Черкесия",city:"",operator:"",desc:""},{mask:"+7(8782)##-##-##",cc:"RU",cd:"Russia",region:"Республика Карачаево-Черкесия",city:"Черкесск",operator:"",desc:""},{mask:"+7(87870)#-##-##",cc:"RU",cd:"Russia",region:"Республика Карачаево-Черкесия",city:"Адыге-Хабль",operator:"",desc:""},{mask:"+7(87872)#-##-##",cc:"RU",cd:"Russia",region:"Республика Карачаево-Черкесия",city:["Теберда","Домбай"],operator:"",desc:""},{mask:"+7(87873)#-##-##",cc:"RU",cd:"Russia",region:"Республика Карачаево-Черкесия",city:"Хабез",operator:"",desc:""},{mask:"+7(87874)#-##-##",cc:"RU",cd:"Russia",region:"Республика Карачаево-Черкесия",city:"Кавказский",operator:"",desc:""},{mask:"+7(87875)#-##-##",cc:"RU",cd:"Russia",region:"Республика Карачаево-Черкесия",city:"Усть-Джегута",operator:"",desc:""},{mask:"+7(87876)#-##-##",cc:"RU",cd:"Russia",region:"Республика Карачаево-Черкесия",city:"Преградная",operator:"",desc:""},{mask:"+7(87877)#-##-##",cc:"RU",cd:"Russia",region:"Республика Карачаево-Черкесия",city:"Учкекен",operator:"",desc:""},{mask:"+7(87878)#-##-##",cc:"RU",cd:"Russia",region:"Республика Карачаево-Черкесия",city:"Зеленчукская",operator:"",desc:""},{mask:"+7(87879)#-##-##",cc:"RU",cd:"Russia",region:"Республика Карачаево-Черкесия",city:"Карачаевск",operator:"",desc:""},{mask:"+7(879)###-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"",operator:"",desc:""},{mask:"+7(87922)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Минеральные Воды",operator:"",desc:""},{mask:"+7(8793)##-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Пятигорск",operator:"",desc:""},{mask:"+7(87932)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Железноводск",operator:"",desc:""},{mask:"+7(87934)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Ессентуки",operator:"",desc:""},{mask:"+7(87935)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Лермонтов",operator:"",desc:""},{mask:"+7(87937)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Кисловодск",operator:"",desc:""},{mask:"+7(87938)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Новопавловск",operator:"",desc:""},{mask:"+7(87951)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Георгиевск",operator:"",desc:""},{mask:"+7(87961)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Ессентукская",operator:"",desc:""},{mask:"+7(87964)#-##-##",cc:"RU",cd:"Russia",region:"Ставропольский край",city:"Курская",operator:"",desc:""},{mask:"+7(9##)###-##-##",cc:"RU",cd:"Russia",type:"mobile"}]}}),c});
/*!
* Parsley.js
* Version 2.8.1 - built Sat, Feb 3rd 2018, 2:27 pm
* http://parsleyjs.org
* Guillaume Potier - <guillaume@wisembly.com>
* Marc-Andre Lafortune - <petroselinum@marc-andre.ca>
* MIT Licensed
*/
function _toConsumableArray(e){if(Array.isArray(e)){for(var t=0,i=Array(e.length);t<e.length;t++)i[t]=e[t];return i}return Array.from(e)}var _slice=Array.prototype.slice,_slicedToArray=function(){function e(e,t){var i=[],n=!0,r=!1,s=void 0;try{for(var a,o=e[Symbol.iterator]();!(n=(a=o.next()).done)&&(i.push(a.value),!t||i.length!==t);n=!0);}catch(l){r=!0,s=l}finally{try{!n&&o["return"]&&o["return"]()}finally{if(r)throw s}}return i}return function(t,i){if(Array.isArray(t))return t;if(Symbol.iterator in Object(t))return e(t,i);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),_extends=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var i=arguments[t];for(var n in i)Object.prototype.hasOwnProperty.call(i,n)&&(e[n]=i[n])}return e};!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t(require("jquery")):"function"==typeof define&&define.amd?define(["jquery"],t):e.parsley=t(e.jQuery)}(this,function(e){"use strict";function t(e,t){return e.parsleyAdaptedCallback||(e.parsleyAdaptedCallback=function(){var i=Array.prototype.slice.call(arguments,0);i.unshift(this),e.apply(t||M,i)}),e.parsleyAdaptedCallback}function i(e){return 0===e.lastIndexOf(D,0)?e.substr(D.length):e}/**
   * inputevent - Alleviate browser bugs for input events
   * https://github.com/marcandre/inputevent
   * @version v0.0.3 - (built Thu, Apr 14th 2016, 5:58 pm)
   * @author Marc-Andre Lafortune <github@marc-andre.ca>
   * @license MIT
   */
function n(){var t=this,i=window||global;_extends(this,{isNativeEvent:function(e){return e.originalEvent&&e.originalEvent.isTrusted!==!1},fakeInputEvent:function(i){t.isNativeEvent(i)&&e(i.target).trigger("input")},misbehaves:function(i){t.isNativeEvent(i)&&(t.behavesOk(i),e(document).on("change.inputevent",i.data.selector,t.fakeInputEvent),t.fakeInputEvent(i))},behavesOk:function(i){t.isNativeEvent(i)&&e(document).off("input.inputevent",i.data.selector,t.behavesOk).off("change.inputevent",i.data.selector,t.misbehaves)},install:function(){if(!i.inputEventPatched){i.inputEventPatched="0.0.3";for(var n=["select",'input[type="checkbox"]','input[type="radio"]','input[type="file"]'],r=0;r<n.length;r++){var s=n[r];e(document).on("input.inputevent",s,{selector:s},t.behavesOk).on("change.inputevent",s,{selector:s},t.misbehaves)}}},uninstall:function(){delete i.inputEventPatched,e(document).off(".inputevent")}})}var r=1,s={},a={attr:function(e,t,i){var n,r,s,a=new RegExp("^"+t,"i");if("undefined"==typeof i)i={};else for(n in i)i.hasOwnProperty(n)&&delete i[n];if(!e)return i;for(s=e.attributes,n=s.length;n--;)r=s[n],r&&r.specified&&a.test(r.name)&&(i[this.camelize(r.name.slice(t.length))]=this.deserializeValue(r.value));return i},checkAttr:function(e,t,i){return e.hasAttribute(t+i)},setAttr:function(e,t,i,n){e.setAttribute(this.dasherize(t+i),String(n))},getType:function(e){return e.getAttribute("type")||"text"},generateID:function(){return""+r++},deserializeValue:function(e){var t;try{return e?"true"==e||"false"!=e&&("null"==e?null:isNaN(t=Number(e))?/^[\[\{]/.test(e)?JSON.parse(e):e:t):e}catch(i){return e}},camelize:function(e){return e.replace(/-+(.)?/g,function(e,t){return t?t.toUpperCase():""})},dasherize:function(e){return e.replace(/::/g,"/").replace(/([A-Z]+)([A-Z][a-z])/g,"$1_$2").replace(/([a-z\d])([A-Z])/g,"$1_$2").replace(/_/g,"-").toLowerCase()},warn:function(){var e;window.console&&"function"==typeof window.console.warn&&(e=window.console).warn.apply(e,arguments)},warnOnce:function(e){s[e]||(s[e]=!0,this.warn.apply(this,arguments))},_resetWarnings:function(){s={}},trimString:function(e){return e.replace(/^\s+|\s+$/g,"")},parse:{date:function S(e){var t=e.match(/^(\d{4,})-(\d\d)-(\d\d)$/);if(!t)return null;var i=t.map(function(e){return parseInt(e,10)}),n=_slicedToArray(i,4),r=(n[0],n[1]),s=n[2],a=n[3],S=new Date(r,s-1,a);return S.getFullYear()!==r||S.getMonth()+1!==s||S.getDate()!==a?null:S},string:function(e){return e},integer:function(e){return isNaN(e)?null:parseInt(e,10)},number:function(e){if(isNaN(e))throw null;return parseFloat(e)},"boolean":function(e){return!/^\s*false\s*$/i.test(e)},object:function(e){return a.deserializeValue(e)},regexp:function(e){var t="";return/^\/.*\/(?:[gimy]*)$/.test(e)?(t=e.replace(/.*\/([gimy]*)$/,"$1"),e=e.replace(new RegExp("^/(.*?)/"+t+"$"),"$1")):e="^"+e+"$",new RegExp(e,t)}},parseRequirement:function(e,t){var i=this.parse[e||"string"];if(!i)throw'Unknown requirement specification: "'+e+'"';var n=i(t);if(null===n)throw"Requirement is not a "+e+': "'+t+'"';return n},namespaceEvents:function(t,i){return t=this.trimString(t||"").split(/\s+/),t[0]?e.map(t,function(e){return e+"."+i}).join(" "):""},difference:function(t,i){var n=[];return e.each(t,function(e,t){i.indexOf(t)==-1&&n.push(t)}),n},all:function(t){return e.when.apply(e,_toConsumableArray(t).concat([42,42]))},objectCreate:Object.create||function(){var e=function(){};return function(t){if(arguments.length>1)throw Error("Second argument not supported");if("object"!=typeof t)throw TypeError("Argument must be an object");e.prototype=t;var i=new e;return e.prototype=null,i}}(),_SubmitSelector:'input[type="submit"], button:submit'},o={namespace:"data-parsley-",inputs:"input, textarea, select",excluded:"input[type=button], input[type=submit], input[type=reset], input[type=hidden]",priorityEnabled:!0,multiple:null,group:null,uiEnabled:!0,validationThreshold:3,focus:"first",trigger:!1,triggerAfterFailure:"input",errorClass:"parsley-error",successClass:"parsley-success",classHandler:function(e){},errorsContainer:function(e){},errorsWrapper:'<ul class="parsley-errors-list"></ul>',errorTemplate:"<li></li>"},l=function(){this.__id__=a.generateID()};l.prototype={asyncSupport:!0,_pipeAccordingToValidationResult:function(){var t=this,i=function(){var i=e.Deferred();return!0!==t.validationResult&&i.reject(),i.resolve().promise()};return[i,i]},actualizeOptions:function(){return a.attr(this.element,this.options.namespace,this.domOptions),this.parent&&this.parent.actualizeOptions&&this.parent.actualizeOptions(),this},_resetOptions:function(e){this.domOptions=a.objectCreate(this.parent.options),this.options=a.objectCreate(this.domOptions);for(var t in e)e.hasOwnProperty(t)&&(this.options[t]=e[t]);this.actualizeOptions()},_listeners:null,on:function(e,t){this._listeners=this._listeners||{};var i=this._listeners[e]=this._listeners[e]||[];return i.push(t),this},subscribe:function(t,i){e.listenTo(this,t.toLowerCase(),i)},off:function(e,t){var i=this._listeners&&this._listeners[e];if(i)if(t)for(var n=i.length;n--;)i[n]===t&&i.splice(n,1);else delete this._listeners[e];return this},unsubscribe:function(t,i){e.unsubscribeTo(this,t.toLowerCase())},trigger:function(e,t,i){t=t||this;var n,r=this._listeners&&this._listeners[e];if(r)for(var s=r.length;s--;)if(n=r[s].call(t,t,i),n===!1)return n;return!this.parent||this.parent.trigger(e,t,i)},asyncIsValid:function(e,t){return a.warnOnce("asyncIsValid is deprecated; please use whenValid instead"),this.whenValid({group:e,force:t})},_findRelated:function(){return this.options.multiple?e(this.parent.element.querySelectorAll("["+this.options.namespace+'multiple="'+this.options.multiple+'"]')):this.$element}};var u=function(e,t){var i=e.match(/^\s*\[(.*)\]\s*$/);if(!i)throw'Requirement is not an array: "'+e+'"';var n=i[1].split(",").map(a.trimString);if(n.length!==t)throw"Requirement has "+n.length+" values when "+t+" are needed";return n},d=function(e,t,i){var n=null,r={};for(var s in e)if(s){var o=i(s);"string"==typeof o&&(o=a.parseRequirement(e[s],o)),r[s]=o}else n=a.parseRequirement(e[s],t);return[n,r]},h=function(t){e.extend(!0,this,t)};h.prototype={validate:function(e,t){if(this.fn)return arguments.length>3&&(t=[].slice.call(arguments,1,-1)),this.fn(e,t);if(Array.isArray(e)){if(!this.validateMultiple)throw"Validator `"+this.name+"` does not handle multiple values";return this.validateMultiple.apply(this,arguments)}var i=arguments[arguments.length-1];if(this.validateDate&&i._isDateInput())return arguments[0]=a.parse.date(arguments[0]),null!==arguments[0]&&this.validateDate.apply(this,arguments);if(this.validateNumber)return!isNaN(e)&&(arguments[0]=parseFloat(arguments[0]),this.validateNumber.apply(this,arguments));if(this.validateString)return this.validateString.apply(this,arguments);throw"Validator `"+this.name+"` only handles multiple values"},parseRequirements:function(t,i){if("string"!=typeof t)return Array.isArray(t)?t:[t];var n=this.requirementType;if(Array.isArray(n)){for(var r=u(t,n.length),s=0;s<r.length;s++)r[s]=a.parseRequirement(n[s],r[s]);return r}return e.isPlainObject(n)?d(n,t,i):[a.parseRequirement(n,t)]},requirementType:"string",priority:2};var p=function(e,t){this.__class__="ValidatorRegistry",this.locale="en",this.init(e||{},t||{})},c={email:/^((([a-zA-Z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-zA-Z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/,number:/^-?(\d*\.)?\d+(e[-+]?\d+)?$/i,integer:/^-?\d+$/,digits:/^\d+$/,alphanum:/^\w+$/i,date:{test:function(e){return null!==a.parse.date(e)}},url:new RegExp("^(?:(?:https?|ftp)://)?(?:\\S+(?::\\S*)?@)?(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-zA-Z\\u00a1-\\uffff0-9]-*)*[a-zA-Z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-zA-Z\\u00a1-\\uffff0-9]-*)*[a-zA-Z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-zA-Z\\u00a1-\\uffff]{2,})))(?::\\d{2,5})?(?:/\\S*)?$")};c.range=c.number;var f=function(e){var t=(""+e).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);return t?Math.max(0,(t[1]?t[1].length:0)-(t[2]?+t[2]:0)):0},m=function(e,t){return t.map(a.parse[e])},g=function(e,t){return function(i){for(var n=arguments.length,r=Array(n>1?n-1:0),s=1;s<n;s++)r[s-1]=arguments[s];return r.pop(),t.apply(void 0,[i].concat(_toConsumableArray(m(e,r))))}},v=function(e){return{validateDate:g("date",e),validateNumber:g("number",e),requirementType:e.length<=2?"string":["string","string"],priority:30}};p.prototype={init:function(e,t){this.catalog=t,this.validators=_extends({},this.validators);for(var i in e)this.addValidator(i,e[i].fn,e[i].priority);window.Parsley.trigger("parsley:validator:init")},setLocale:function(e){if("undefined"==typeof this.catalog[e])throw new Error(e+" is not available in the catalog");return this.locale=e,this},addCatalog:function(e,t,i){return"object"==typeof t&&(this.catalog[e]=t),!0===i?this.setLocale(e):this},addMessage:function(e,t,i){return"undefined"==typeof this.catalog[e]&&(this.catalog[e]={}),this.catalog[e][t]=i,this},addMessages:function(e,t){for(var i in t)this.addMessage(e,i,t[i]);return this},addValidator:function(e,t,i){if(this.validators[e])a.warn('Validator "'+e+'" is already defined.');else if(o.hasOwnProperty(e))return void a.warn('"'+e+'" is a restricted keyword and is not a valid validator name.');return this._setValidator.apply(this,arguments)},hasValidator:function(e){return!!this.validators[e]},updateValidator:function(e,t,i){return this.validators[e]?this._setValidator.apply(this,arguments):(a.warn('Validator "'+e+'" is not already defined.'),this.addValidator.apply(this,arguments))},removeValidator:function(e){return this.validators[e]||a.warn('Validator "'+e+'" is not defined.'),delete this.validators[e],this},_setValidator:function(e,t,i){"object"!=typeof t&&(t={fn:t,priority:i}),t.validate||(t=new h(t)),this.validators[e]=t;for(var n in t.messages||{})this.addMessage(n,e,t.messages[n]);return this},getErrorMessage:function(e){var t;if("type"===e.name){var i=this.catalog[this.locale][e.name]||{};t=i[e.requirements]}else t=this.formatMessage(this.catalog[this.locale][e.name],e.requirements);return t||this.catalog[this.locale].defaultMessage||this.catalog.en.defaultMessage},formatMessage:function(e,t){if("object"==typeof t){for(var i in t)e=this.formatMessage(e,t[i]);return e}return"string"==typeof e?e.replace(/%s/i,t):""},validators:{notblank:{validateString:function(e){return/\S/.test(e)},priority:2},required:{validateMultiple:function(e){return e.length>0},validateString:function(e){return/\S/.test(e)},priority:512},type:{validateString:function(e,t){var i=arguments.length<=2||void 0===arguments[2]?{}:arguments[2],n=i.step,r=void 0===n?"any":n,s=i.base,a=void 0===s?0:s,o=c[t];if(!o)throw new Error("validator type `"+t+"` is not supported");if(!o.test(e))return!1;if("number"===t&&!/^any$/i.test(r||"")){var l=Number(e),u=Math.max(f(r),f(a));if(f(l)>u)return!1;var d=function(e){return Math.round(e*Math.pow(10,u))};if((d(l)-d(a))%d(r)!=0)return!1}return!0},requirementType:{"":"string",step:"string",base:"number"},priority:256},pattern:{validateString:function(e,t){return t.test(e)},requirementType:"regexp",priority:64},minlength:{validateString:function(e,t){return e.length>=t},requirementType:"integer",priority:30},maxlength:{validateString:function(e,t){return e.length<=t},requirementType:"integer",priority:30},length:{validateString:function(e,t,i){return e.length>=t&&e.length<=i},requirementType:["integer","integer"],priority:30},mincheck:{validateMultiple:function(e,t){return e.length>=t},requirementType:"integer",priority:30},maxcheck:{validateMultiple:function(e,t){return e.length<=t},requirementType:"integer",priority:30},check:{validateMultiple:function(e,t,i){return e.length>=t&&e.length<=i},requirementType:["integer","integer"],priority:30},min:v(function(e,t){return e>=t}),max:v(function(e,t){return e<=t}),range:v(function(e,t,i){return e>=t&&e<=i}),equalto:{validateString:function(t,i){var n=e(i);return n.length?t===n.val():t===i},priority:256}}};var y={},_=function k(e,t,i){for(var n=[],r=[],s=0;s<e.length;s++){for(var a=!1,o=0;o<t.length;o++)if(e[s].assert.name===t[o].assert.name){a=!0;break}a?r.push(e[s]):n.push(e[s])}return{kept:r,added:n,removed:i?[]:k(t,e,!0).added}};y.Form={_actualizeTriggers:function(){var e=this;this.$element.on("submit.Parsley",function(t){e.onSubmitValidate(t)}),this.$element.on("click.Parsley",a._SubmitSelector,function(t){e.onSubmitButton(t)}),!1!==this.options.uiEnabled&&this.element.setAttribute("novalidate","")},focus:function(){if(this._focusedField=null,!0===this.validationResult||"none"===this.options.focus)return null;for(var e=0;e<this.fields.length;e++){var t=this.fields[e];if(!0!==t.validationResult&&t.validationResult.length>0&&"undefined"==typeof t.options.noFocus&&(this._focusedField=t.$element,"first"===this.options.focus))break}return null===this._focusedField?null:this._focusedField.focus()},_destroyUI:function(){this.$element.off(".Parsley")}},y.Field={_reflowUI:function(){if(this._buildUI(),this._ui){var e=_(this.validationResult,this._ui.lastValidationResult);this._ui.lastValidationResult=this.validationResult,this._manageStatusClass(),this._manageErrorsMessages(e),this._actualizeTriggers(),!e.kept.length&&!e.added.length||this._failedOnce||(this._failedOnce=!0,this._actualizeTriggers())}},getErrorsMessages:function(){if(!0===this.validationResult)return[];for(var e=[],t=0;t<this.validationResult.length;t++)e.push(this.validationResult[t].errorMessage||this._getErrorMessage(this.validationResult[t].assert));return e},addError:function(e){var t=arguments.length<=1||void 0===arguments[1]?{}:arguments[1],i=t.message,n=t.assert,r=t.updateClass,s=void 0===r||r;this._buildUI(),this._addError(e,{message:i,assert:n}),s&&this._errorClass()},updateError:function(e){var t=arguments.length<=1||void 0===arguments[1]?{}:arguments[1],i=t.message,n=t.assert,r=t.updateClass,s=void 0===r||r;this._buildUI(),this._updateError(e,{message:i,assert:n}),s&&this._errorClass()},removeError:function(e){var t=arguments.length<=1||void 0===arguments[1]?{}:arguments[1],i=t.updateClass,n=void 0===i||i;this._buildUI(),this._removeError(e),n&&this._manageStatusClass()},_manageStatusClass:function(){this.hasConstraints()&&this.needsValidation()&&!0===this.validationResult?this._successClass():this.validationResult.length>0?this._errorClass():this._resetClass()},_manageErrorsMessages:function(t){if("undefined"==typeof this.options.errorsMessagesDisabled){if("undefined"!=typeof this.options.errorMessage)return t.added.length||t.kept.length?(this._insertErrorWrapper(),0===this._ui.$errorsWrapper.find(".parsley-custom-error-message").length&&this._ui.$errorsWrapper.append(e(this.options.errorTemplate).addClass("parsley-custom-error-message")),this._ui.$errorsWrapper.addClass("filled").find(".parsley-custom-error-message").html(this.options.errorMessage)):this._ui.$errorsWrapper.removeClass("filled").find(".parsley-custom-error-message").remove();for(var i=0;i<t.removed.length;i++)this._removeError(t.removed[i].assert.name);for(i=0;i<t.added.length;i++)this._addError(t.added[i].assert.name,{message:t.added[i].errorMessage,assert:t.added[i].assert});for(i=0;i<t.kept.length;i++)this._updateError(t.kept[i].assert.name,{message:t.kept[i].errorMessage,assert:t.kept[i].assert})}},_addError:function(t,i){var n=i.message,r=i.assert;this._insertErrorWrapper(),this._ui.$errorClassHandler.attr("aria-describedby",this._ui.errorsWrapperId),this._ui.$errorsWrapper.addClass("filled").append(e(this.options.errorTemplate).addClass("parsley-"+t).html(n||this._getErrorMessage(r)))},_updateError:function(e,t){var i=t.message,n=t.assert;this._ui.$errorsWrapper.addClass("filled").find(".parsley-"+e).html(i||this._getErrorMessage(n))},_removeError:function(e){this._ui.$errorClassHandler.removeAttr("aria-describedby"),this._ui.$errorsWrapper.removeClass("filled").find(".parsley-"+e).remove()},_getErrorMessage:function(e){var t=e.name+"Message";return"undefined"!=typeof this.options[t]?window.Parsley.formatMessage(this.options[t],e.requirements):window.Parsley.getErrorMessage(e)},_buildUI:function(){if(!this._ui&&!1!==this.options.uiEnabled){var t={};this.element.setAttribute(this.options.namespace+"id",this.__id__),t.$errorClassHandler=this._manageClassHandler(),t.errorsWrapperId="parsley-id-"+(this.options.multiple?"multiple-"+this.options.multiple:this.__id__),t.$errorsWrapper=e(this.options.errorsWrapper).attr("id",t.errorsWrapperId),t.lastValidationResult=[],t.validationInformationVisible=!1,this._ui=t}},_manageClassHandler:function(){if("string"==typeof this.options.classHandler&&e(this.options.classHandler).length)return e(this.options.classHandler);var t=this.options.classHandler;if("string"==typeof this.options.classHandler&&"function"==typeof window[this.options.classHandler]&&(t=window[this.options.classHandler]),"function"==typeof t){var i=t.call(this,this);if("undefined"!=typeof i&&i.length)return i}else{if("object"==typeof t&&t instanceof jQuery&&t.length)return t;t&&a.warn("The class handler `"+t+"` does not exist in DOM nor as a global JS function")}return this._inputHolder()},_inputHolder:function(){return this.options.multiple&&"SELECT"!==this.element.nodeName?this.$element.parent():this.$element},_insertErrorWrapper:function(){var t=this.options.errorsContainer;if(0!==this._ui.$errorsWrapper.parent().length)return this._ui.$errorsWrapper.parent();if("string"==typeof t){if(e(t).length)return e(t).append(this._ui.$errorsWrapper);"function"==typeof window[t]?t=window[t]:a.warn("The errors container `"+t+"` does not exist in DOM nor as a global JS function")}return"function"==typeof t&&(t=t.call(this,this)),"object"==typeof t&&t.length?t.append(this._ui.$errorsWrapper):this._inputHolder().after(this._ui.$errorsWrapper)},_actualizeTriggers:function(){var e,t=this,i=this._findRelated();i.off(".Parsley"),this._failedOnce?i.on(a.namespaceEvents(this.options.triggerAfterFailure,"Parsley"),function(){t._validateIfNeeded()}):(e=a.namespaceEvents(this.options.trigger,"Parsley"))&&i.on(e,function(e){t._validateIfNeeded(e)})},_validateIfNeeded:function(e){var t=this;e&&/key|input/.test(e.type)&&(!this._ui||!this._ui.validationInformationVisible)&&this.getValue().length<=this.options.validationThreshold||(this.options.debounce?(window.clearTimeout(this._debounced),this._debounced=window.setTimeout(function(){return t.validate()},this.options.debounce)):this.validate())},_resetUI:function(){this._failedOnce=!1,this._actualizeTriggers(),"undefined"!=typeof this._ui&&(this._ui.$errorsWrapper.removeClass("filled").children().remove(),this._resetClass(),this._ui.lastValidationResult=[],this._ui.validationInformationVisible=!1)},_destroyUI:function(){this._resetUI(),"undefined"!=typeof this._ui&&this._ui.$errorsWrapper.remove(),delete this._ui},_successClass:function(){this._ui.validationInformationVisible=!0,this._ui.$errorClassHandler.removeClass(this.options.errorClass).addClass(this.options.successClass)},_errorClass:function(){this._ui.validationInformationVisible=!0,this._ui.$errorClassHandler.removeClass(this.options.successClass).addClass(this.options.errorClass)},_resetClass:function(){this._ui.$errorClassHandler.removeClass(this.options.successClass).removeClass(this.options.errorClass)}};var w=function(t,i,n){this.__class__="Form",this.element=t,this.$element=e(t),this.domOptions=i,this.options=n,this.parent=window.Parsley,this.fields=[],this.validationResult=null},b={pending:null,resolved:!0,rejected:!1};w.prototype={onSubmitValidate:function(e){var t=this;if(!0!==e.parsley){var i=this._submitSource||this.$element.find(a._SubmitSelector)[0];if(this._submitSource=null,this.$element.find(".parsley-synthetic-submit-button").prop("disabled",!0),!i||null===i.getAttribute("formnovalidate")){window.Parsley._remoteCache={};var n=this.whenValidate({event:e});"resolved"===n.state()&&!1!==this._trigger("submit")||(e.stopImmediatePropagation(),e.preventDefault(),"pending"===n.state()&&n.done(function(){t._submit(i)}))}}},onSubmitButton:function(e){this._submitSource=e.currentTarget},_submit:function(t){if(!1!==this._trigger("submit")){if(t){var i=this.$element.find(".parsley-synthetic-submit-button").prop("disabled",!1);0===i.length&&(i=e('<input class="parsley-synthetic-submit-button" type="hidden">').appendTo(this.$element)),i.attr({name:t.getAttribute("name"),value:t.getAttribute("value")})}this.$element.trigger(_extends(e.Event("submit"),{parsley:!0}))}},validate:function(t){if(arguments.length>=1&&!e.isPlainObject(t)){a.warnOnce("Calling validate on a parsley form without passing arguments as an object is deprecated.");var i=_slice.call(arguments),n=i[0],r=i[1],s=i[2];t={group:n,force:r,event:s}}return b[this.whenValidate(t).state()]},whenValidate:function(){var t,i=this,n=arguments.length<=0||void 0===arguments[0]?{}:arguments[0],r=n.group,s=n.force,o=n.event;this.submitEvent=o,o&&(this.submitEvent=_extends({},o,{preventDefault:function(){a.warnOnce("Using `this.submitEvent.preventDefault()` is deprecated; instead, call `this.validationResult = false`"),i.validationResult=!1}})),this.validationResult=!0,this._trigger("validate"),this._refreshFields();var l=this._withoutReactualizingFormOptions(function(){return e.map(i.fields,function(e){return e.whenValidate({force:s,group:r})})});return(t=a.all(l).done(function(){i._trigger("success")}).fail(function(){i.validationResult=!1,i.focus(),i._trigger("error")}).always(function(){i._trigger("validated")})).pipe.apply(t,_toConsumableArray(this._pipeAccordingToValidationResult()))},isValid:function(t){if(arguments.length>=1&&!e.isPlainObject(t)){a.warnOnce("Calling isValid on a parsley form without passing arguments as an object is deprecated.");var i=_slice.call(arguments),n=i[0],r=i[1];t={group:n,force:r}}return b[this.whenValid(t).state()]},whenValid:function(){var t=this,i=arguments.length<=0||void 0===arguments[0]?{}:arguments[0],n=i.group,r=i.force;this._refreshFields();var s=this._withoutReactualizingFormOptions(function(){return e.map(t.fields,function(e){return e.whenValid({group:n,force:r})})});return a.all(s)},refresh:function(){return this._refreshFields(),this},reset:function(){for(var e=0;e<this.fields.length;e++)this.fields[e].reset();this._trigger("reset")},destroy:function(){this._destroyUI();for(var e=0;e<this.fields.length;e++)this.fields[e].destroy();this.$element.removeData("Parsley"),this._trigger("destroy")},_refreshFields:function(){return this.actualizeOptions()._bindFields()},_bindFields:function(){var t=this,i=this.fields;return this.fields=[],this.fieldsMappedById={},this._withoutReactualizingFormOptions(function(){t.$element.find(t.options.inputs).not(t.options.excluded).each(function(e,i){var n=new window.Parsley.Factory(i,{},t);if(("Field"===n.__class__||"FieldMultiple"===n.__class__)&&!0!==n.options.excluded){var r=n.__class__+"-"+n.__id__;"undefined"==typeof t.fieldsMappedById[r]&&(t.fieldsMappedById[r]=n,t.fields.push(n))}}),e.each(a.difference(i,t.fields),function(e,t){t.reset()})}),this},_withoutReactualizingFormOptions:function(e){var t=this.actualizeOptions;this.actualizeOptions=function(){return this};var i=e();return this.actualizeOptions=t,i},_trigger:function(e){return this.trigger("form:"+e)}};var F=function(e,t,i,n,r){var s=window.Parsley._validatorRegistry.validators[t],a=new h(s);n=n||e.options[t+"Priority"]||a.priority,r=!0===r,_extends(this,{validator:a,name:t,requirements:i,priority:n,isDomConstraint:r}),this._parseRequirements(e.options)},C=function(e){var t=e[0].toUpperCase();return t+e.slice(1)};F.prototype={validate:function(e,t){var i;return(i=this.validator).validate.apply(i,[e].concat(_toConsumableArray(this.requirementList),[t]))},_parseRequirements:function(e){var t=this;this.requirementList=this.validator.parseRequirements(this.requirements,function(i){return e[t.name+C(i)]})}};var A=function(t,i,n,r){this.__class__="Field",this.element=t,this.$element=e(t),"undefined"!=typeof r&&(this.parent=r),this.options=n,this.domOptions=i,this.constraints=[],this.constraintsByName={},this.validationResult=!0,this._bindConstraints()},E={pending:null,resolved:!0,rejected:!1};A.prototype={validate:function(t){arguments.length>=1&&!e.isPlainObject(t)&&(a.warnOnce("Calling validate on a parsley field without passing arguments as an object is deprecated."),t={options:t});var i=this.whenValidate(t);if(!i)return!0;switch(i.state()){case"pending":return null;case"resolved":return!0;case"rejected":return this.validationResult}},whenValidate:function(){var e,t=this,i=arguments.length<=0||void 0===arguments[0]?{}:arguments[0],n=i.force,r=i.group;if(this.refresh(),!r||this._isInGroup(r))return this.value=this.getValue(),this._trigger("validate"),(e=this.whenValid({force:n,value:this.value,_refreshed:!0}).always(function(){t._reflowUI()}).done(function(){t._trigger("success")}).fail(function(){t._trigger("error")}).always(function(){t._trigger("validated")})).pipe.apply(e,_toConsumableArray(this._pipeAccordingToValidationResult()))},hasConstraints:function(){return 0!==this.constraints.length},needsValidation:function(e){return"undefined"==typeof e&&(e=this.getValue()),!(!e.length&&!this._isRequired()&&"undefined"==typeof this.options.validateIfEmpty)},_isInGroup:function(t){return Array.isArray(this.options.group)?-1!==e.inArray(t,this.options.group):this.options.group===t},isValid:function(t){if(arguments.length>=1&&!e.isPlainObject(t)){a.warnOnce("Calling isValid on a parsley field without passing arguments as an object is deprecated.");var i=_slice.call(arguments),n=i[0],r=i[1];t={force:n,value:r}}var s=this.whenValid(t);return!s||E[s.state()]},whenValid:function(){var t=this,i=arguments.length<=0||void 0===arguments[0]?{}:arguments[0],n=i.force,r=void 0!==n&&n,s=i.value,o=i.group,l=i._refreshed;if(l||this.refresh(),!o||this._isInGroup(o)){if(this.validationResult=!0,!this.hasConstraints())return e.when();if("undefined"!=typeof s&&null!==s||(s=this.getValue()),!this.needsValidation(s)&&!0!==r)return e.when();var u=this._getGroupedConstraints(),d=[];return e.each(u,function(i,n){var r=a.all(e.map(n,function(e){return t._validateConstraint(s,e)}));if(d.push(r),"rejected"===r.state())return!1}),a.all(d)}},_validateConstraint:function(t,i){var n=this,r=i.validate(t,this);return!1===r&&(r=e.Deferred().reject()),a.all([r]).fail(function(e){n.validationResult instanceof Array||(n.validationResult=[]),n.validationResult.push({assert:i,errorMessage:"string"==typeof e&&e})})},getValue:function(){var e;return e="function"==typeof this.options.value?this.options.value(this):"undefined"!=typeof this.options.value?this.options.value:this.$element.val(),"undefined"==typeof e||null===e?"":this._handleWhitespace(e)},reset:function(){return this._resetUI(),this._trigger("reset")},destroy:function(){this._destroyUI(),this.$element.removeData("Parsley"),this.$element.removeData("FieldMultiple"),this._trigger("destroy")},refresh:function(){return this._refreshConstraints(),this},_refreshConstraints:function(){return this.actualizeOptions()._bindConstraints()},refreshConstraints:function(){return a.warnOnce("Parsley's refreshConstraints is deprecated. Please use refresh"),this.refresh()},addConstraint:function(e,t,i,n){if(window.Parsley._validatorRegistry.validators[e]){var r=new F(this,e,t,i,n);"undefined"!==this.constraintsByName[r.name]&&this.removeConstraint(r.name),this.constraints.push(r),this.constraintsByName[r.name]=r}return this},removeConstraint:function(e){for(var t=0;t<this.constraints.length;t++)if(e===this.constraints[t].name){this.constraints.splice(t,1);break}return delete this.constraintsByName[e],this},updateConstraint:function(e,t,i){return this.removeConstraint(e).addConstraint(e,t,i)},_bindConstraints:function(){for(var e=[],t={},i=0;i<this.constraints.length;i++)!1===this.constraints[i].isDomConstraint&&(e.push(this.constraints[i]),t[this.constraints[i].name]=this.constraints[i]);this.constraints=e,this.constraintsByName=t;for(var n in this.options)this.addConstraint(n,this.options[n],void 0,!0);return this._bindHtml5Constraints()},_bindHtml5Constraints:function(){null!==this.element.getAttribute("required")&&this.addConstraint("required",!0,void 0,!0),null!==this.element.getAttribute("pattern")&&this.addConstraint("pattern",this.element.getAttribute("pattern"),void 0,!0);var e=this.element.getAttribute("min"),t=this.element.getAttribute("max");null!==e&&null!==t?this.addConstraint("range",[e,t],void 0,!0):null!==e?this.addConstraint("min",e,void 0,!0):null!==t&&this.addConstraint("max",t,void 0,!0),null!==this.element.getAttribute("minlength")&&null!==this.element.getAttribute("maxlength")?this.addConstraint("length",[this.element.getAttribute("minlength"),this.element.getAttribute("maxlength")],void 0,!0):null!==this.element.getAttribute("minlength")?this.addConstraint("minlength",this.element.getAttribute("minlength"),void 0,!0):null!==this.element.getAttribute("maxlength")&&this.addConstraint("maxlength",this.element.getAttribute("maxlength"),void 0,!0);var i=a.getType(this.element);return"number"===i?this.addConstraint("type",["number",{step:this.element.getAttribute("step")||"1",base:e||this.element.getAttribute("value")}],void 0,!0):/^(email|url|range|date)$/i.test(i)?this.addConstraint("type",i,void 0,!0):this},_isRequired:function(){return"undefined"!=typeof this.constraintsByName.required&&!1!==this.constraintsByName.required.requirements},_trigger:function(e){return this.trigger("field:"+e)},_handleWhitespace:function(e){return!0===this.options.trimValue&&a.warnOnce('data-parsley-trim-value="true" is deprecated, please use data-parsley-whitespace="trim"'),"squish"===this.options.whitespace&&(e=e.replace(/\s{2,}/g," ")),"trim"!==this.options.whitespace&&"squish"!==this.options.whitespace&&!0!==this.options.trimValue||(e=a.trimString(e)),e},_isDateInput:function(){var e=this.constraintsByName.type;return e&&"date"===e.requirements},_getGroupedConstraints:function(){if(!1===this.options.priorityEnabled)return[this.constraints];for(var e=[],t={},i=0;i<this.constraints.length;i++){var n=this.constraints[i].priority;t[n]||e.push(t[n]=[]),t[n].push(this.constraints[i])}return e.sort(function(e,t){return t[0].priority-e[0].priority}),e}};var x=A,$=function(){this.__class__="FieldMultiple"};$.prototype={addElement:function(e){return this.$elements.push(e),this},_refreshConstraints:function(){var t;if(this.constraints=[],"SELECT"===this.element.nodeName)return this.actualizeOptions()._bindConstraints(),this;for(var i=0;i<this.$elements.length;i++)if(e("html").has(this.$elements[i]).length){t=this.$elements[i].data("FieldMultiple")._refreshConstraints().constraints;for(var n=0;n<t.length;n++)this.addConstraint(t[n].name,t[n].requirements,t[n].priority,t[n].isDomConstraint)}else this.$elements.splice(i,1);return this},getValue:function(){if("function"==typeof this.options.value)return this.options.value(this);if("undefined"!=typeof this.options.value)return this.options.value;if("INPUT"===this.element.nodeName){var t=a.getType(this.element);if("radio"===t)return this._findRelated().filter(":checked").val()||"";if("checkbox"===t){
var i=[];return this._findRelated().filter(":checked").each(function(){i.push(e(this).val())}),i}}return"SELECT"===this.element.nodeName&&null===this.$element.val()?[]:this.$element.val()},_init:function(){return this.$elements=[this.$element],this}};var P=function(t,i,n){this.element=t,this.$element=e(t);var r=this.$element.data("Parsley");if(r)return"undefined"!=typeof n&&r.parent===window.Parsley&&(r.parent=n,r._resetOptions(r.options)),"object"==typeof i&&_extends(r.options,i),r;if(!this.$element.length)throw new Error("You must bind Parsley on an existing element.");if("undefined"!=typeof n&&"Form"!==n.__class__)throw new Error("Parent instance must be a Form instance");return this.parent=n||window.Parsley,this.init(i)};P.prototype={init:function(e){return this.__class__="Parsley",this.__version__="2.8.1",this.__id__=a.generateID(),this._resetOptions(e),"FORM"===this.element.nodeName||a.checkAttr(this.element,this.options.namespace,"validate")&&!this.$element.is(this.options.inputs)?this.bind("parsleyForm"):this.isMultiple()?this.handleMultiple():this.bind("parsleyField")},isMultiple:function(){var e=a.getType(this.element);return"radio"===e||"checkbox"===e||"SELECT"===this.element.nodeName&&null!==this.element.getAttribute("multiple")},handleMultiple:function(){var t,i,n=this;if(this.options.multiple=this.options.multiple||(t=this.element.getAttribute("name"))||this.element.getAttribute("id"),"SELECT"===this.element.nodeName&&null!==this.element.getAttribute("multiple"))return this.options.multiple=this.options.multiple||this.__id__,this.bind("parsleyFieldMultiple");if(!this.options.multiple)return a.warn("To be bound by Parsley, a radio, a checkbox and a multiple select input must have either a name or a multiple option.",this.$element),this;this.options.multiple=this.options.multiple.replace(/(:|\.|\[|\]|\{|\}|\$)/g,""),t&&e('input[name="'+t+'"]').each(function(e,t){var i=a.getType(t);"radio"!==i&&"checkbox"!==i||t.setAttribute(n.options.namespace+"multiple",n.options.multiple)});for(var r=this._findRelated(),s=0;s<r.length;s++)if(i=e(r.get(s)).data("Parsley"),"undefined"!=typeof i){this.$element.data("FieldMultiple")||i.addElement(this.$element);break}return this.bind("parsleyField",!0),i||this.bind("parsleyFieldMultiple")},bind:function(t,i){var n;switch(t){case"parsleyForm":n=e.extend(new w(this.element,this.domOptions,this.options),new l,window.ParsleyExtend)._bindFields();break;case"parsleyField":n=e.extend(new x(this.element,this.domOptions,this.options,this.parent),new l,window.ParsleyExtend);break;case"parsleyFieldMultiple":n=e.extend(new x(this.element,this.domOptions,this.options,this.parent),new $,new l,window.ParsleyExtend)._init();break;default:throw new Error(t+"is not a supported Parsley type")}return this.options.multiple&&a.setAttr(this.element,this.options.namespace,"multiple",this.options.multiple),"undefined"!=typeof i?(this.$element.data("FieldMultiple",n),n):(this.$element.data("Parsley",n),n._actualizeTriggers(),n._trigger("init"),n)}};var V=e.fn.jquery.split(".");if(parseInt(V[0])<=1&&parseInt(V[1])<8)throw"The loaded version of jQuery is too old. Please upgrade to 1.8.x or better.";V.forEach||a.warn("Parsley requires ES5 to run properly. Please include https://github.com/es-shims/es5-shim");var T=_extends(new l,{element:document,$element:e(document),actualizeOptions:null,_resetOptions:null,Factory:P,version:"2.8.1"});_extends(x.prototype,y.Field,l.prototype),_extends(w.prototype,y.Form,l.prototype),_extends(P.prototype,l.prototype),e.fn.parsley=e.fn.psly=function(t){if(this.length>1){var i=[];return this.each(function(){i.push(e(this).parsley(t))}),i}if(0!=this.length)return new P(this[0],t)},"undefined"==typeof window.ParsleyExtend&&(window.ParsleyExtend={}),T.options=_extends(a.objectCreate(o),window.ParsleyConfig),window.ParsleyConfig=T.options,window.Parsley=window.psly=T,T.Utils=a,window.ParsleyUtils={},e.each(a,function(e,t){"function"==typeof t&&(window.ParsleyUtils[e]=function(){return a.warnOnce("Accessing `window.ParsleyUtils` is deprecated. Use `window.Parsley.Utils` instead."),a[e].apply(a,arguments)})});var O=window.Parsley._validatorRegistry=new p(window.ParsleyConfig.validators,window.ParsleyConfig.i18n);window.ParsleyValidator={},e.each("setLocale addCatalog addMessage addMessages getErrorMessage formatMessage addValidator updateValidator removeValidator hasValidator".split(" "),function(e,t){window.Parsley[t]=function(){return O[t].apply(O,arguments)},window.ParsleyValidator[t]=function(){var e;return a.warnOnce("Accessing the method '"+t+"' through Validator is deprecated. Simply call 'window.Parsley."+t+"(...)'"),(e=window.Parsley)[t].apply(e,arguments)}}),window.Parsley.UI=y,window.ParsleyUI={removeError:function(e,t,i){var n=!0!==i;return a.warnOnce("Accessing UI is deprecated. Call 'removeError' on the instance directly. Please comment in issue 1073 as to your need to call this method."),e.removeError(t,{updateClass:n})},getErrorsMessages:function(e){return a.warnOnce("Accessing UI is deprecated. Call 'getErrorsMessages' on the instance directly."),e.getErrorsMessages()}},e.each("addError updateError".split(" "),function(e,t){window.ParsleyUI[t]=function(e,i,n,r,s){var o=!0!==s;return a.warnOnce("Accessing UI is deprecated. Call '"+t+"' on the instance directly. Please comment in issue 1073 as to your need to call this method."),e[t](i,{message:n,assert:r,updateClass:o})}}),!1!==window.ParsleyConfig.autoBind&&e(function(){e("[data-parsley-validate]").length&&e("[data-parsley-validate]").parsley()});var M=e({}),R=function(){a.warnOnce("Parsley's pubsub module is deprecated; use the 'on' and 'off' methods on parsley instances or window.Parsley")},D="parsley:";e.listen=function(e,n){var r;if(R(),"object"==typeof arguments[1]&&"function"==typeof arguments[2]&&(r=arguments[1],n=arguments[2]),"function"!=typeof n)throw new Error("Wrong parameters");window.Parsley.on(i(e),t(n,r))},e.listenTo=function(e,n,r){if(R(),!(e instanceof x||e instanceof w))throw new Error("Must give Parsley instance");if("string"!=typeof n||"function"!=typeof r)throw new Error("Wrong parameters");e.on(i(n),t(r))},e.unsubscribe=function(e,t){if(R(),"string"!=typeof e||"function"!=typeof t)throw new Error("Wrong arguments");window.Parsley.off(i(e),t.parsleyAdaptedCallback)},e.unsubscribeTo=function(e,t){if(R(),!(e instanceof x||e instanceof w))throw new Error("Must give Parsley instance");e.off(i(t))},e.unsubscribeAll=function(t){R(),window.Parsley.off(i(t)),e("form,input,textarea,select").each(function(){var n=e(this).data("Parsley");n&&n.off(i(t))})},e.emit=function(e,t){var n;R();var r=t instanceof x||t instanceof w,s=Array.prototype.slice.call(arguments,r?2:1);s.unshift(i(e)),r||(t=window.Parsley),(n=t).trigger.apply(n,_toConsumableArray(s))};e.extend(!0,T,{asyncValidators:{"default":{fn:function(e){return e.status>=200&&e.status<300},url:!1},reverse:{fn:function(e){return e.status<200||e.status>=300},url:!1}},addAsyncValidator:function(e,t,i,n){return T.asyncValidators[e]={fn:t,url:i||!1,options:n||{}},this}}),T.addValidator("remote",{requirementType:{"":"string",validator:"string",reverse:"boolean",options:"object"},validateString:function(t,i,n,r){var s,a,o={},l=n.validator||(!0===n.reverse?"reverse":"default");if("undefined"==typeof T.asyncValidators[l])throw new Error("Calling an undefined async validator: `"+l+"`");i=T.asyncValidators[l].url||i,i.indexOf("{value}")>-1?i=i.replace("{value}",encodeURIComponent(t)):o[r.element.getAttribute("name")||r.element.getAttribute("id")]=t;var u=e.extend(!0,n.options||{},T.asyncValidators[l].options);s=e.extend(!0,{},{url:i,data:o,type:"GET"},u),r.trigger("field:ajaxoptions",r,s),a=e.param(s),"undefined"==typeof T._remoteCache&&(T._remoteCache={});var d=T._remoteCache[a]=T._remoteCache[a]||e.ajax(s),h=function(){var t=T.asyncValidators[l].fn.call(r,d,i,n);return t||(t=e.Deferred().reject()),e.when(t)};return d.then(h,h)},priority:-1}),T.on("form:submit",function(){T._remoteCache={}}),l.prototype.addAsyncValidator=function(){return a.warnOnce("Accessing the method `addAsyncValidator` through an instance is deprecated. Simply call `Parsley.addAsyncValidator(...)`"),T.addAsyncValidator.apply(T,arguments)},T.addMessages("en",{defaultMessage:"This value seems to be invalid.",type:{email:"This value should be a valid email.",url:"This value should be a valid url.",number:"This value should be a valid number.",integer:"This value should be a valid integer.",digits:"This value should be digits.",alphanum:"This value should be alphanumeric."},notblank:"This value should not be blank.",required:"This value is required.",pattern:"This value seems to be invalid.",min:"This value should be greater than or equal to %s.",max:"This value should be lower than or equal to %s.",range:"This value should be between %s and %s.",minlength:"This value is too short. It should have %s characters or more.",maxlength:"This value is too long. It should have %s characters or fewer.",length:"This value length is invalid. It should be between %s and %s characters long.",mincheck:"You must select at least %s choices.",maxcheck:"You must select %s choices or fewer.",check:"You must select between %s and %s choices.",equalto:"This value should be the same."}),T.setLocale("en");var I=new n;I.install();var q=T;return q});
//# sourceMappingURL=parsley.min.js.map

/*!
 * jQuery Form Plugin
 * version: 4.2.2
 * Requires jQuery v1.7.2 or later
 * Project repository: https://github.com/jquery-form/form

 * Copyright 2017 Kevin Morris
 * Copyright 2006 M. Alsup

 * Dual licensed under the LGPL-2.1+ or MIT licenses
 * https://github.com/jquery-form/form#license

 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 */
!function(e){"function"==typeof define&&define.amd?define(["jquery"],e):"object"==typeof module&&module.exports?module.exports=function(t,r){return void 0===r&&(r="undefined"!=typeof window?require("jquery"):require("jquery")(t)),e(r),r}:e(jQuery)}(function(e){"use strict";function t(t){var r=t.data;t.isDefaultPrevented()||(t.preventDefault(),e(t.target).closest("form").ajaxSubmit(r))}function r(t){var r=t.target,a=e(r);if(!a.is("[type=submit],[type=image]")){var n=a.closest("[type=submit]");if(0===n.length)return;r=n[0]}var i=r.form;if(i.clk=r,"image"===r.type)if(void 0!==t.offsetX)i.clk_x=t.offsetX,i.clk_y=t.offsetY;else if("function"==typeof e.fn.offset){var o=a.offset();i.clk_x=t.pageX-o.left,i.clk_y=t.pageY-o.top}else i.clk_x=t.pageX-r.offsetLeft,i.clk_y=t.pageY-r.offsetTop;setTimeout(function(){i.clk=i.clk_x=i.clk_y=null},100)}function a(){if(e.fn.ajaxSubmit.debug){var t="[jquery.form] "+Array.prototype.join.call(arguments,"");window.console&&window.console.log?window.console.log(t):window.opera&&window.opera.postError&&window.opera.postError(t)}}var n=/\r?\n/g,i={};i.fileapi=void 0!==e('<input type="file">').get(0).files,i.formdata=void 0!==window.FormData;var o=!!e.fn.prop;e.fn.attr2=function(){if(!o)return this.attr.apply(this,arguments);var e=this.prop.apply(this,arguments);return e&&e.jquery||"string"==typeof e?e:this.attr.apply(this,arguments)},e.fn.ajaxSubmit=function(t,r,n,s){function u(r){var a,n,i=e.param(r,t.traditional).split("&"),o=i.length,s=[];for(a=0;a<o;a++)i[a]=i[a].replace(/\+/g," "),n=i[a].split("="),s.push([decodeURIComponent(n[0]),decodeURIComponent(n[1])]);return s}function c(r){function n(e){var t=null;try{e.contentWindow&&(t=e.contentWindow.document)}catch(e){a("cannot get iframe.contentWindow document: "+e)}if(t)return t;try{t=e.contentDocument?e.contentDocument:e.document}catch(r){a("cannot get iframe.contentDocument: "+r),t=e.document}return t}function i(){function t(){try{var e=n(v).readyState;a("state = "+e),e&&"uninitialized"===e.toLowerCase()&&setTimeout(t,50)}catch(e){a("Server abort: ",e," (",e.name,")"),s(L),j&&clearTimeout(j),j=void 0}}var r=p.attr2("target"),i=p.attr2("action"),o=p.attr("enctype")||p.attr("encoding")||"multipart/form-data";w.setAttribute("target",m),l&&!/post/i.test(l)||w.setAttribute("method","POST"),i!==f.url&&w.setAttribute("action",f.url),f.skipEncodingOverride||l&&!/post/i.test(l)||p.attr({encoding:"multipart/form-data",enctype:"multipart/form-data"}),f.timeout&&(j=setTimeout(function(){T=!0,s(A)},f.timeout));var u=[];try{if(f.extraData)for(var c in f.extraData)f.extraData.hasOwnProperty(c)&&(e.isPlainObject(f.extraData[c])&&f.extraData[c].hasOwnProperty("name")&&f.extraData[c].hasOwnProperty("value")?u.push(e('<input type="hidden" name="'+f.extraData[c].name+'">',k).val(f.extraData[c].value).appendTo(w)[0]):u.push(e('<input type="hidden" name="'+c+'">',k).val(f.extraData[c]).appendTo(w)[0]));f.iframeTarget||h.appendTo(D),v.attachEvent?v.attachEvent("onload",s):v.addEventListener("load",s,!1),setTimeout(t,15);try{w.submit()}catch(e){document.createElement("form").submit.apply(w)}}finally{w.setAttribute("action",i),w.setAttribute("enctype",o),r?w.setAttribute("target",r):p.removeAttr("target"),e(u).remove()}}function s(t){if(!x.aborted&&!X){if((O=n(v))||(a("cannot access response document"),t=L),t===A&&x)return x.abort("timeout"),void S.reject(x,"timeout");if(t===L&&x)return x.abort("server abort"),void S.reject(x,"error","server abort");if(O&&O.location.href!==f.iframeSrc||T){v.detachEvent?v.detachEvent("onload",s):v.removeEventListener("load",s,!1);var r,i="success";try{if(T)throw"timeout";var o="xml"===f.dataType||O.XMLDocument||e.isXMLDoc(O);if(a("isXml="+o),!o&&window.opera&&(null===O.body||!O.body.innerHTML)&&--C)return a("requeing onLoad callback, DOM not available"),void setTimeout(s,250);var u=O.body?O.body:O.documentElement;x.responseText=u?u.innerHTML:null,x.responseXML=O.XMLDocument?O.XMLDocument:O,o&&(f.dataType="xml"),x.getResponseHeader=function(e){return{"content-type":f.dataType}[e.toLowerCase()]},u&&(x.status=Number(u.getAttribute("status"))||x.status,x.statusText=u.getAttribute("statusText")||x.statusText);var c=(f.dataType||"").toLowerCase(),l=/(json|script|text)/.test(c);if(l||f.textarea){var p=O.getElementsByTagName("textarea")[0];if(p)x.responseText=p.value,x.status=Number(p.getAttribute("status"))||x.status,x.statusText=p.getAttribute("statusText")||x.statusText;else if(l){var m=O.getElementsByTagName("pre")[0],g=O.getElementsByTagName("body")[0];m?x.responseText=m.textContent?m.textContent:m.innerText:g&&(x.responseText=g.textContent?g.textContent:g.innerText)}}else"xml"===c&&!x.responseXML&&x.responseText&&(x.responseXML=q(x.responseText));try{M=N(x,c,f)}catch(e){i="parsererror",x.error=r=e||i}}catch(e){a("error caught: ",e),i="error",x.error=r=e||i}x.aborted&&(a("upload aborted"),i=null),x.status&&(i=x.status>=200&&x.status<300||304===x.status?"success":"error"),"success"===i?(f.success&&f.success.call(f.context,M,"success",x),S.resolve(x.responseText,"success",x),d&&e.event.trigger("ajaxSuccess",[x,f])):i&&(void 0===r&&(r=x.statusText),f.error&&f.error.call(f.context,x,i,r),S.reject(x,"error",r),d&&e.event.trigger("ajaxError",[x,f,r])),d&&e.event.trigger("ajaxComplete",[x,f]),d&&!--e.active&&e.event.trigger("ajaxStop"),f.complete&&f.complete.call(f.context,x,i),X=!0,f.timeout&&clearTimeout(j),setTimeout(function(){f.iframeTarget?h.attr("src",f.iframeSrc):h.remove(),x.responseXML=null},100)}}}var u,c,f,d,m,h,v,x,y,b,T,j,w=p[0],S=e.Deferred();if(S.abort=function(e){x.abort(e)},r)for(c=0;c<g.length;c++)u=e(g[c]),o?u.prop("disabled",!1):u.removeAttr("disabled");(f=e.extend(!0,{},e.ajaxSettings,t)).context=f.context||f,m="jqFormIO"+(new Date).getTime();var k=w.ownerDocument,D=p.closest("body");if(f.iframeTarget?(b=(h=e(f.iframeTarget,k)).attr2("name"))?m=b:h.attr2("name",m):(h=e('<iframe name="'+m+'" src="'+f.iframeSrc+'" />',k)).css({position:"absolute",top:"-1000px",left:"-1000px"}),v=h[0],x={aborted:0,responseText:null,responseXML:null,status:0,statusText:"n/a",getAllResponseHeaders:function(){},getResponseHeader:function(){},setRequestHeader:function(){},abort:function(t){var r="timeout"===t?"timeout":"aborted";a("aborting upload... "+r),this.aborted=1;try{v.contentWindow.document.execCommand&&v.contentWindow.document.execCommand("Stop")}catch(e){}h.attr("src",f.iframeSrc),x.error=r,f.error&&f.error.call(f.context,x,r,t),d&&e.event.trigger("ajaxError",[x,f,r]),f.complete&&f.complete.call(f.context,x,r)}},(d=f.global)&&0==e.active++&&e.event.trigger("ajaxStart"),d&&e.event.trigger("ajaxSend",[x,f]),f.beforeSend&&!1===f.beforeSend.call(f.context,x,f))return f.global&&e.active--,S.reject(),S;if(x.aborted)return S.reject(),S;(y=w.clk)&&(b=y.name)&&!y.disabled&&(f.extraData=f.extraData||{},f.extraData[b]=y.value,"image"===y.type&&(f.extraData[b+".x"]=w.clk_x,f.extraData[b+".y"]=w.clk_y));var A=1,L=2,F=e("meta[name=csrf-token]").attr("content"),E=e("meta[name=csrf-param]").attr("content");E&&F&&(f.extraData=f.extraData||{},f.extraData[E]=F),f.forceSync?i():setTimeout(i,10);var M,O,X,C=50,q=e.parseXML||function(e,t){return window.ActiveXObject?((t=new ActiveXObject("Microsoft.XMLDOM")).async="false",t.loadXML(e)):t=(new DOMParser).parseFromString(e,"text/xml"),t&&t.documentElement&&"parsererror"!==t.documentElement.nodeName?t:null},_=e.parseJSON||function(e){return window.eval("("+e+")")},N=function(t,r,a){var n=t.getResponseHeader("content-type")||"",i=("xml"===r||!r)&&n.indexOf("xml")>=0,o=i?t.responseXML:t.responseText;return i&&"parsererror"===o.documentElement.nodeName&&e.error&&e.error("parsererror"),a&&a.dataFilter&&(o=a.dataFilter(o,r)),"string"==typeof o&&(("json"===r||!r)&&n.indexOf("json")>=0?o=_(o):("script"===r||!r)&&n.indexOf("javascript")>=0&&e.globalEval(o)),o};return S}if(!this.length)return a("ajaxSubmit: skipping submit process - no element selected"),this;var l,f,d,p=this;"function"==typeof t?t={success:t}:"string"==typeof t||!1===t&&arguments.length>0?(t={url:t,data:r,dataType:n},"function"==typeof s&&(t.success=s)):void 0===t&&(t={}),l=t.method||t.type||this.attr2("method"),(d=(d="string"==typeof(f=t.url||this.attr2("action"))?e.trim(f):"")||window.location.href||"")&&(d=(d.match(/^([^#]+)/)||[])[1]),t=e.extend(!0,{url:d,success:e.ajaxSettings.success,type:l||e.ajaxSettings.type,iframeSrc:/^https/i.test(window.location.href||"")?"javascript:false":"about:blank"},t);var m={};if(this.trigger("form-pre-serialize",[this,t,m]),m.veto)return a("ajaxSubmit: submit vetoed via form-pre-serialize trigger"),this;if(t.beforeSerialize&&!1===t.beforeSerialize(this,t))return a("ajaxSubmit: submit aborted via beforeSerialize callback"),this;var h=t.traditional;void 0===h&&(h=e.ajaxSettings.traditional);var v,g=[],x=this.formToArray(t.semantic,g,t.filtering);if(t.data){var y=e.isFunction(t.data)?t.data(x):t.data;t.extraData=y,v=e.param(y,h)}if(t.beforeSubmit&&!1===t.beforeSubmit(x,this,t))return a("ajaxSubmit: submit aborted via beforeSubmit callback"),this;if(this.trigger("form-submit-validate",[x,this,t,m]),m.veto)return a("ajaxSubmit: submit vetoed via form-submit-validate trigger"),this;var b=e.param(x,h);v&&(b=b?b+"&"+v:v),"GET"===t.type.toUpperCase()?(t.url+=(t.url.indexOf("?")>=0?"&":"?")+b,t.data=null):t.data=b;var T=[];if(t.resetForm&&T.push(function(){p.resetForm()}),t.clearForm&&T.push(function(){p.clearForm(t.includeHidden)}),!t.dataType&&t.target){var j=t.success||function(){};T.push(function(r,a,n){var i=arguments,o=t.replaceTarget?"replaceWith":"html";e(t.target)[o](r).each(function(){j.apply(this,i)})})}else t.success&&(e.isArray(t.success)?e.merge(T,t.success):T.push(t.success));if(t.success=function(e,r,a){for(var n=t.context||this,i=0,o=T.length;i<o;i++)T[i].apply(n,[e,r,a||p,p])},t.error){var w=t.error;t.error=function(e,r,a){var n=t.context||this;w.apply(n,[e,r,a,p])}}if(t.complete){var S=t.complete;t.complete=function(e,r){var a=t.context||this;S.apply(a,[e,r,p])}}var k=e("input[type=file]:enabled",this).filter(function(){return""!==e(this).val()}).length>0,D="multipart/form-data",A=p.attr("enctype")===D||p.attr("encoding")===D,L=i.fileapi&&i.formdata;a("fileAPI :"+L);var F,E=(k||A)&&!L;!1!==t.iframe&&(t.iframe||E)?t.closeKeepAlive?e.get(t.closeKeepAlive,function(){F=c(x)}):F=c(x):F=(k||A)&&L?function(r){for(var a=new FormData,n=0;n<r.length;n++)a.append(r[n].name,r[n].value);if(t.extraData){var i=u(t.extraData);for(n=0;n<i.length;n++)i[n]&&a.append(i[n][0],i[n][1])}t.data=null;var o=e.extend(!0,{},e.ajaxSettings,t,{contentType:!1,processData:!1,cache:!1,type:l||"POST"});t.uploadProgress&&(o.xhr=function(){var r=e.ajaxSettings.xhr();return r.upload&&r.upload.addEventListener("progress",function(e){var r=0,a=e.loaded||e.position,n=e.total;e.lengthComputable&&(r=Math.ceil(a/n*100)),t.uploadProgress(e,a,n,r)},!1),r}),o.data=null;var s=o.beforeSend;return o.beforeSend=function(e,r){t.formData?r.data=t.formData:r.data=a,s&&s.call(this,e,r)},e.ajax(o)}(x):e.ajax(t),p.removeData("jqxhr").data("jqxhr",F);for(var M=0;M<g.length;M++)g[M]=null;return this.trigger("form-submit-notify",[this,t]),this},e.fn.ajaxForm=function(n,i,o,s){if(("string"==typeof n||!1===n&&arguments.length>0)&&(n={url:n,data:i,dataType:o},"function"==typeof s&&(n.success=s)),n=n||{},n.delegation=n.delegation&&e.isFunction(e.fn.on),!n.delegation&&0===this.length){var u={s:this.selector,c:this.context};return!e.isReady&&u.s?(a("DOM not ready, queuing ajaxForm"),e(function(){e(u.s,u.c).ajaxForm(n)}),this):(a("terminating; zero elements found by selector"+(e.isReady?"":" (DOM not ready)")),this)}return n.delegation?(e(document).off("submit.form-plugin",this.selector,t).off("click.form-plugin",this.selector,r).on("submit.form-plugin",this.selector,n,t).on("click.form-plugin",this.selector,n,r),this):this.ajaxFormUnbind().on("submit.form-plugin",n,t).on("click.form-plugin",n,r)},e.fn.ajaxFormUnbind=function(){return this.off("submit.form-plugin click.form-plugin")},e.fn.formToArray=function(t,r,a){var n=[];if(0===this.length)return n;var o,s=this[0],u=this.attr("id"),c=t||void 0===s.elements?s.getElementsByTagName("*"):s.elements;if(c&&(c=e.makeArray(c)),u&&(t||/(Edge|Trident)\//.test(navigator.userAgent))&&(o=e(':input[form="'+u+'"]').get()).length&&(c=(c||[]).concat(o)),!c||!c.length)return n;e.isFunction(a)&&(c=e.map(c,a));var l,f,d,p,m,h,v;for(l=0,h=c.length;l<h;l++)if(m=c[l],(d=m.name)&&!m.disabled)if(t&&s.clk&&"image"===m.type)s.clk===m&&(n.push({name:d,value:e(m).val(),type:m.type}),n.push({name:d+".x",value:s.clk_x},{name:d+".y",value:s.clk_y}));else if((p=e.fieldValue(m,!0))&&p.constructor===Array)for(r&&r.push(m),f=0,v=p.length;f<v;f++)n.push({name:d,value:p[f]});else if(i.fileapi&&"file"===m.type){r&&r.push(m);var g=m.files;if(g.length)for(f=0;f<g.length;f++)n.push({name:d,value:g[f],type:m.type});else n.push({name:d,value:"",type:m.type})}else null!==p&&void 0!==p&&(r&&r.push(m),n.push({name:d,value:p,type:m.type,required:m.required}));if(!t&&s.clk){var x=e(s.clk),y=x[0];(d=y.name)&&!y.disabled&&"image"===y.type&&(n.push({name:d,value:x.val()}),n.push({name:d+".x",value:s.clk_x},{name:d+".y",value:s.clk_y}))}return n},e.fn.formSerialize=function(t){return e.param(this.formToArray(t))},e.fn.fieldSerialize=function(t){var r=[];return this.each(function(){var a=this.name;if(a){var n=e.fieldValue(this,t);if(n&&n.constructor===Array)for(var i=0,o=n.length;i<o;i++)r.push({name:a,value:n[i]});else null!==n&&void 0!==n&&r.push({name:this.name,value:n})}}),e.param(r)},e.fn.fieldValue=function(t){for(var r=[],a=0,n=this.length;a<n;a++){var i=this[a],o=e.fieldValue(i,t);null===o||void 0===o||o.constructor===Array&&!o.length||(o.constructor===Array?e.merge(r,o):r.push(o))}return r},e.fieldValue=function(t,r){var a=t.name,i=t.type,o=t.tagName.toLowerCase();if(void 0===r&&(r=!0),r&&(!a||t.disabled||"reset"===i||"button"===i||("checkbox"===i||"radio"===i)&&!t.checked||("submit"===i||"image"===i)&&t.form&&t.form.clk!==t||"select"===o&&-1===t.selectedIndex))return null;if("select"===o){var s=t.selectedIndex;if(s<0)return null;for(var u=[],c=t.options,l="select-one"===i,f=l?s+1:c.length,d=l?s:0;d<f;d++){var p=c[d];if(p.selected&&!p.disabled){var m=p.value;if(m||(m=p.attributes&&p.attributes.value&&!p.attributes.value.specified?p.text:p.value),l)return m;u.push(m)}}return u}return e(t).val().replace(n,"\r\n")},e.fn.clearForm=function(t){return this.each(function(){e("input,select,textarea",this).clearFields(t)})},e.fn.clearFields=e.fn.clearInputs=function(t){var r=/^(?:color|date|datetime|email|month|number|password|range|search|tel|text|time|url|week)$/i;return this.each(function(){var a=this.type,n=this.tagName.toLowerCase();r.test(a)||"textarea"===n?this.value="":"checkbox"===a||"radio"===a?this.checked=!1:"select"===n?this.selectedIndex=-1:"file"===a?/MSIE/.test(navigator.userAgent)?e(this).replaceWith(e(this).clone(!0)):e(this).val(""):t&&(!0===t&&/hidden/.test(a)||"string"==typeof t&&e(this).is(t))&&(this.value="")})},e.fn.resetForm=function(){return this.each(function(){var t=e(this),r=this.tagName.toLowerCase();switch(r){case"input":this.checked=this.defaultChecked;case"textarea":return this.value=this.defaultValue,!0;case"option":case"optgroup":var a=t.parents("select");return a.length&&a[0].multiple?"option"===r?this.selected=this.defaultSelected:t.find("option").resetForm():a.resetForm(),!0;case"select":return t.find("option").each(function(e){if(this.selected=this.defaultSelected,this.defaultSelected&&!t[0].multiple)return t[0].selectedIndex=e,!1}),!0;case"label":var n=e(t.attr("for")),i=t.find("input,select,textarea");return n[0]&&i.unshift(n[0]),i.resetForm(),!0;case"form":return("function"==typeof this.reset||"object"==typeof this.reset&&!this.reset.nodeType)&&this.reset(),!0;default:return t.find("form,input,label,select,textarea").resetForm(),!0}})},e.fn.enable=function(e){return void 0===e&&(e=!0),this.each(function(){this.disabled=!e})},e.fn.selected=function(t){return void 0===t&&(t=!0),this.each(function(){var r=this.type;if("checkbox"===r||"radio"===r)this.checked=t;else if("option"===this.tagName.toLowerCase()){var a=e(this).parent("select");t&&a[0]&&"select-one"===a[0].type&&a.find("option").selected(!1),this.selected=t}})},e.fn.ajaxSubmit.debug=!1});
//# sourceMappingURL=jquery.form.min.js.map

//     Backbone.js 1.3.3

//     (c) 2010-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://backbonejs.org

(function(factory) {

  // Establish the root object, `window` (`self`) in the browser, or `global` on the server.
  // We use `self` instead of `window` for `WebWorker` support.
  var root = (typeof self == 'object' && self.self === self && self) ||
            (typeof global == 'object' && global.global === global && global);

  // Set up Backbone appropriately for the environment. Start with AMD.
  if (typeof define === 'function' && define.amd) {
    define(['underscore', 'jquery', 'exports'], function(_, $, exports) {
      // Export global even in AMD case in case this script is loaded with
      // others that may still expect a global Backbone.
      root.Backbone = factory(root, exports, _, $);
    });

  // Next for Node.js or CommonJS. jQuery may not be needed as a module.
  } else if (typeof exports !== 'undefined') {
    var _ = require('underscore'), $;
    try { $ = require('jquery'); } catch (e) {}
    factory(root, exports, _, $);

  // Finally, as a browser global.
  } else {
    root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
  }

})(function(root, Backbone, _, $) {

  // Initial Setup
  // -------------

  // Save the previous value of the `Backbone` variable, so that it can be
  // restored later on, if `noConflict` is used.
  var previousBackbone = root.Backbone;

  // Create a local reference to a common array method we'll want to use later.
  var slice = Array.prototype.slice;

  // Current version of the library. Keep in sync with `package.json`.
  Backbone.VERSION = '1.3.3';

  // For Backbone's purposes, jQuery, Zepto, Ender, or My Library (kidding) owns
  // the `$` variable.
  Backbone.$ = $;

  // Runs Backbone.js in *noConflict* mode, returning the `Backbone` variable
  // to its previous owner. Returns a reference to this Backbone object.
  Backbone.noConflict = function() {
    root.Backbone = previousBackbone;
    return this;
  };

  // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
  // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
  // set a `X-Http-Method-Override` header.
  Backbone.emulateHTTP = false;

  // Turn on `emulateJSON` to support legacy servers that can't deal with direct
  // `application/json` requests ... this will encode the body as
  // `application/x-www-form-urlencoded` instead and will send the model in a
  // form param named `model`.
  Backbone.emulateJSON = false;

  // Proxy Backbone class methods to Underscore functions, wrapping the model's
  // `attributes` object or collection's `models` array behind the scenes.
  //
  // collection.filter(function(model) { return model.get('age') > 10 });
  // collection.each(this.addView);
  //
  // `Function#apply` can be slow so we use the method's arg count, if we know it.
  var addMethod = function(length, method, attribute) {
    switch (length) {
      case 1: return function() {
        return _[method](this[attribute]);
      };
      case 2: return function(value) {
        return _[method](this[attribute], value);
      };
      case 3: return function(iteratee, context) {
        return _[method](this[attribute], cb(iteratee, this), context);
      };
      case 4: return function(iteratee, defaultVal, context) {
        return _[method](this[attribute], cb(iteratee, this), defaultVal, context);
      };
      default: return function() {
        var args = slice.call(arguments);
        args.unshift(this[attribute]);
        return _[method].apply(_, args);
      };
    }
  };
  var addUnderscoreMethods = function(Class, methods, attribute) {
    _.each(methods, function(length, method) {
      if (_[method]) Class.prototype[method] = addMethod(length, method, attribute);
    });
  };

  // Support `collection.sortBy('attr')` and `collection.findWhere({id: 1})`.
  var cb = function(iteratee, instance) {
    if (_.isFunction(iteratee)) return iteratee;
    if (_.isObject(iteratee) && !instance._isModel(iteratee)) return modelMatcher(iteratee);
    if (_.isString(iteratee)) return function(model) { return model.get(iteratee); };
    return iteratee;
  };
  var modelMatcher = function(attrs) {
    var matcher = _.matches(attrs);
    return function(model) {
      return matcher(model.attributes);
    };
  };

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // a custom event channel. You may bind a callback to an event with `on` or
  // remove with `off`; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  var Events = Backbone.Events = {};

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Iterates over the standard `event, callback` (as well as the fancy multiple
  // space-separated events `"change blur", callback` and jQuery-style event
  // maps `{event: callback}`).
  var eventsApi = function(iteratee, events, name, callback, opts) {
    var i = 0, names;
    if (name && typeof name === 'object') {
      // Handle event maps.
      if (callback !== void 0 && 'context' in opts && opts.context === void 0) opts.context = callback;
      for (names = _.keys(name); i < names.length ; i++) {
        events = eventsApi(iteratee, events, names[i], name[names[i]], opts);
      }
    } else if (name && eventSplitter.test(name)) {
      // Handle space-separated event names by delegating them individually.
      for (names = name.split(eventSplitter); i < names.length; i++) {
        events = iteratee(events, names[i], callback, opts);
      }
    } else {
      // Finally, standard events.
      events = iteratee(events, name, callback, opts);
    }
    return events;
  };

  // Bind an event to a `callback` function. Passing `"all"` will bind
  // the callback to all events fired.
  Events.on = function(name, callback, context) {
    return internalOn(this, name, callback, context);
  };

  // Guard the `listening` argument from the public API.
  var internalOn = function(obj, name, callback, context, listening) {
    obj._events = eventsApi(onApi, obj._events || {}, name, callback, {
      context: context,
      ctx: obj,
      listening: listening
    });

    if (listening) {
      var listeners = obj._listeners || (obj._listeners = {});
      listeners[listening.id] = listening;
    }

    return obj;
  };

  // Inversion-of-control versions of `on`. Tell *this* object to listen to
  // an event in another object... keeping track of what it's listening to
  // for easier unbinding later.
  Events.listenTo = function(obj, name, callback) {
    if (!obj) return this;
    var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
    var listeningTo = this._listeningTo || (this._listeningTo = {});
    var listening = listeningTo[id];

    // This object is not listening to any other events on `obj` yet.
    // Setup the necessary references to track the listening callbacks.
    if (!listening) {
      var thisId = this._listenId || (this._listenId = _.uniqueId('l'));
      listening = listeningTo[id] = {obj: obj, objId: id, id: thisId, listeningTo: listeningTo, count: 0};
    }

    // Bind callbacks on obj, and keep track of them on listening.
    internalOn(obj, name, callback, this, listening);
    return this;
  };

  // The reducing API that adds a callback to the `events` object.
  var onApi = function(events, name, callback, options) {
    if (callback) {
      var handlers = events[name] || (events[name] = []);
      var context = options.context, ctx = options.ctx, listening = options.listening;
      if (listening) listening.count++;

      handlers.push({callback: callback, context: context, ctx: context || ctx, listening: listening});
    }
    return events;
  };

  // Remove one or many callbacks. If `context` is null, removes all
  // callbacks with that function. If `callback` is null, removes all
  // callbacks for the event. If `name` is null, removes all bound
  // callbacks for all events.
  Events.off = function(name, callback, context) {
    if (!this._events) return this;
    this._events = eventsApi(offApi, this._events, name, callback, {
      context: context,
      listeners: this._listeners
    });
    return this;
  };

  // Tell this object to stop listening to either specific events ... or
  // to every object it's currently listening to.
  Events.stopListening = function(obj, name, callback) {
    var listeningTo = this._listeningTo;
    if (!listeningTo) return this;

    var ids = obj ? [obj._listenId] : _.keys(listeningTo);

    for (var i = 0; i < ids.length; i++) {
      var listening = listeningTo[ids[i]];

      // If listening doesn't exist, this object is not currently
      // listening to obj. Break out early.
      if (!listening) break;

      listening.obj.off(name, callback, this);
    }

    return this;
  };

  // The reducing API that removes a callback from the `events` object.
  var offApi = function(events, name, callback, options) {
    if (!events) return;

    var i = 0, listening;
    var context = options.context, listeners = options.listeners;

    // Delete all events listeners and "drop" events.
    if (!name && !callback && !context) {
      var ids = _.keys(listeners);
      for (; i < ids.length; i++) {
        listening = listeners[ids[i]];
        delete listeners[listening.id];
        delete listening.listeningTo[listening.objId];
      }
      return;
    }

    var names = name ? [name] : _.keys(events);
    for (; i < names.length; i++) {
      name = names[i];
      var handlers = events[name];

      // Bail out if there are no events stored.
      if (!handlers) break;

      // Replace events if there are any remaining.  Otherwise, clean up.
      var remaining = [];
      for (var j = 0; j < handlers.length; j++) {
        var handler = handlers[j];
        if (
          callback && callback !== handler.callback &&
            callback !== handler.callback._callback ||
              context && context !== handler.context
        ) {
          remaining.push(handler);
        } else {
          listening = handler.listening;
          if (listening && --listening.count === 0) {
            delete listeners[listening.id];
            delete listening.listeningTo[listening.objId];
          }
        }
      }

      // Update tail event if the list has any events.  Otherwise, clean up.
      if (remaining.length) {
        events[name] = remaining;
      } else {
        delete events[name];
      }
    }
    return events;
  };

  // Bind an event to only be triggered a single time. After the first time
  // the callback is invoked, its listener will be removed. If multiple events
  // are passed in using the space-separated syntax, the handler will fire
  // once for each event, not once for a combination of all events.
  Events.once = function(name, callback, context) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.off, this));
    if (typeof name === 'string' && context == null) callback = void 0;
    return this.on(events, callback, context);
  };

  // Inversion-of-control versions of `once`.
  Events.listenToOnce = function(obj, name, callback) {
    // Map the event into a `{event: once}` object.
    var events = eventsApi(onceMap, {}, name, callback, _.bind(this.stopListening, this, obj));
    return this.listenTo(obj, events);
  };

  // Reduces the event callbacks into a map of `{event: onceWrapper}`.
  // `offer` unbinds the `onceWrapper` after it has been called.
  var onceMap = function(map, name, callback, offer) {
    if (callback) {
      var once = map[name] = _.once(function() {
        offer(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
    }
    return map;
  };

  // Trigger one or many events, firing all bound callbacks. Callbacks are
  // passed the same arguments as `trigger` is, apart from the event name
  // (unless you're listening on `"all"`, which will cause your callback to
  // receive the true name of the event as the first argument).
  Events.trigger = function(name) {
    if (!this._events) return this;

    var length = Math.max(0, arguments.length - 1);
    var args = Array(length);
    for (var i = 0; i < length; i++) args[i] = arguments[i + 1];

    eventsApi(triggerApi, this._events, name, void 0, args);
    return this;
  };

  // Handles triggering the appropriate event callbacks.
  var triggerApi = function(objEvents, name, callback, args) {
    if (objEvents) {
      var events = objEvents[name];
      var allEvents = objEvents.all;
      if (events && allEvents) allEvents = allEvents.slice();
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, [name].concat(args));
    }
    return objEvents;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args); return;
    }
  };

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Allow the `Backbone` object to serve as a global event bus, for folks who
  // want global "pubsub" in a convenient place.
  _.extend(Backbone, Events);

  // Backbone.Model
  // --------------

  // Backbone **Models** are the basic data object in the framework --
  // frequently representing a row in a table in a database on your server.
  // A discrete chunk of data and a bunch of useful, related methods for
  // performing computations and transformations on that data.

  // Create a new model with the specified attributes. A client id (`cid`)
  // is automatically generated and assigned for you.
  var Model = Backbone.Model = function(attributes, options) {
    var attrs = attributes || {};
    options || (options = {});
    this.cid = _.uniqueId(this.cidPrefix);
    this.attributes = {};
    if (options.collection) this.collection = options.collection;
    if (options.parse) attrs = this.parse(attrs, options) || {};
    var defaults = _.result(this, 'defaults');
    attrs = _.defaults(_.extend({}, defaults, attrs), defaults);
    this.set(attrs, options);
    this.changed = {};
    this.initialize.apply(this, arguments);
  };

  // Attach all inheritable methods to the Model prototype.
  _.extend(Model.prototype, Events, {

    // A hash of attributes whose current and previous value differ.
    changed: null,

    // The value returned during the last failed validation.
    validationError: null,

    // The default name for the JSON `id` attribute is `"id"`. MongoDB and
    // CouchDB users may want to set this to `"_id"`.
    idAttribute: 'id',

    // The prefix is used to create the client id which is used to identify models locally.
    // You may want to override this if you're experiencing name clashes with model ids.
    cidPrefix: 'c',

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Return a copy of the model's `attributes` object.
    toJSON: function(options) {
      return _.clone(this.attributes);
    },

    // Proxy `Backbone.sync` by default -- but override this if you need
    // custom syncing semantics for *this* particular model.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Get the value of an attribute.
    get: function(attr) {
      return this.attributes[attr];
    },

    // Get the HTML-escaped value of an attribute.
    escape: function(attr) {
      return _.escape(this.get(attr));
    },

    // Returns `true` if the attribute contains a value that is not null
    // or undefined.
    has: function(attr) {
      return this.get(attr) != null;
    },

    // Special-cased proxy to underscore's `_.matches` method.
    matches: function(attrs) {
      return !!_.iteratee(attrs, this)(this.attributes);
    },

    // Set a hash of model attributes on the object, firing `"change"`. This is
    // the core primitive operation of a model, updating the data and notifying
    // anyone who needs to know about the change in state. The heart of the beast.
    set: function(key, val, options) {
      if (key == null) return this;

      // Handle both `"key", value` and `{key: value}` -style arguments.
      var attrs;
      if (typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options || (options = {});

      // Run validation.
      if (!this._validate(attrs, options)) return false;

      // Extract attributes and options.
      var unset      = options.unset;
      var silent     = options.silent;
      var changes    = [];
      var changing   = this._changing;
      this._changing = true;

      if (!changing) {
        this._previousAttributes = _.clone(this.attributes);
        this.changed = {};
      }

      var current = this.attributes;
      var changed = this.changed;
      var prev    = this._previousAttributes;

      // For each `set` attribute, update or delete the current value.
      for (var attr in attrs) {
        val = attrs[attr];
        if (!_.isEqual(current[attr], val)) changes.push(attr);
        if (!_.isEqual(prev[attr], val)) {
          changed[attr] = val;
        } else {
          delete changed[attr];
        }
        unset ? delete current[attr] : current[attr] = val;
      }

      // Update the `id`.
      if (this.idAttribute in attrs) this.id = this.get(this.idAttribute);

      // Trigger all relevant attribute changes.
      if (!silent) {
        if (changes.length) this._pending = options;
        for (var i = 0; i < changes.length; i++) {
          this.trigger('change:' + changes[i], this, current[changes[i]], options);
        }
      }

      // You might be wondering why there's a `while` loop here. Changes can
      // be recursively nested within `"change"` events.
      if (changing) return this;
      if (!silent) {
        while (this._pending) {
          options = this._pending;
          this._pending = false;
          this.trigger('change', this, options);
        }
      }
      this._pending = false;
      this._changing = false;
      return this;
    },

    // Remove an attribute from the model, firing `"change"`. `unset` is a noop
    // if the attribute doesn't exist.
    unset: function(attr, options) {
      return this.set(attr, void 0, _.extend({}, options, {unset: true}));
    },

    // Clear all attributes on the model, firing `"change"`.
    clear: function(options) {
      var attrs = {};
      for (var key in this.attributes) attrs[key] = void 0;
      return this.set(attrs, _.extend({}, options, {unset: true}));
    },

    // Determine if the model has changed since the last `"change"` event.
    // If you specify an attribute name, determine if that attribute has changed.
    hasChanged: function(attr) {
      if (attr == null) return !_.isEmpty(this.changed);
      return _.has(this.changed, attr);
    },

    // Return an object containing all the attributes that have changed, or
    // false if there are no changed attributes. Useful for determining what
    // parts of a view need to be updated and/or what attributes need to be
    // persisted to the server. Unset attributes will be set to undefined.
    // You can also pass an attributes object to diff against the model,
    // determining if there *would be* a change.
    changedAttributes: function(diff) {
      if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
      var old = this._changing ? this._previousAttributes : this.attributes;
      var changed = {};
      for (var attr in diff) {
        var val = diff[attr];
        if (_.isEqual(old[attr], val)) continue;
        changed[attr] = val;
      }
      return _.size(changed) ? changed : false;
    },

    // Get the previous value of an attribute, recorded at the time the last
    // `"change"` event was fired.
    previous: function(attr) {
      if (attr == null || !this._previousAttributes) return null;
      return this._previousAttributes[attr];
    },

    // Get all of the attributes of the model at the time of the previous
    // `"change"` event.
    previousAttributes: function() {
      return _.clone(this._previousAttributes);
    },

    // Fetch the model from the server, merging the response with the model's
    // local attributes. Any changed attributes will trigger a "change" event.
    fetch: function(options) {
      options = _.extend({parse: true}, options);
      var model = this;
      var success = options.success;
      options.success = function(resp) {
        var serverAttrs = options.parse ? model.parse(resp, options) : resp;
        if (!model.set(serverAttrs, options)) return false;
        if (success) success.call(options.context, model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Set a hash of model attributes, and sync the model to the server.
    // If the server returns an attributes hash that differs, the model's
    // state will be `set` again.
    save: function(key, val, options) {
      // Handle both `"key", value` and `{key: value}` -style arguments.
      var attrs;
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = _.extend({validate: true, parse: true}, options);
      var wait = options.wait;

      // If we're not waiting and attributes exist, save acts as
      // `set(attr).save(null, opts)` with validation. Otherwise, check if
      // the model will be valid when the attributes, if any, are set.
      if (attrs && !wait) {
        if (!this.set(attrs, options)) return false;
      } else if (!this._validate(attrs, options)) {
        return false;
      }

      // After a successful server-side save, the client is (optionally)
      // updated with the server-side state.
      var model = this;
      var success = options.success;
      var attributes = this.attributes;
      options.success = function(resp) {
        // Ensure attributes are restored during synchronous saves.
        model.attributes = attributes;
        var serverAttrs = options.parse ? model.parse(resp, options) : resp;
        if (wait) serverAttrs = _.extend({}, attrs, serverAttrs);
        if (serverAttrs && !model.set(serverAttrs, options)) return false;
        if (success) success.call(options.context, model, resp, options);
        model.trigger('sync', model, resp, options);
      };
      wrapError(this, options);

      // Set temporary attributes if `{wait: true}` to properly find new ids.
      if (attrs && wait) this.attributes = _.extend({}, attributes, attrs);

      var method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
      if (method === 'patch' && !options.attrs) options.attrs = attrs;
      var xhr = this.sync(method, this, options);

      // Restore attributes.
      this.attributes = attributes;

      return xhr;
    },

    // Destroy this model on the server if it was already persisted.
    // Optimistically removes the model from its collection, if it has one.
    // If `wait: true` is passed, waits for the server to respond before removal.
    destroy: function(options) {
      options = options ? _.clone(options) : {};
      var model = this;
      var success = options.success;
      var wait = options.wait;

      var destroy = function() {
        model.stopListening();
        model.trigger('destroy', model, model.collection, options);
      };

      options.success = function(resp) {
        if (wait) destroy();
        if (success) success.call(options.context, model, resp, options);
        if (!model.isNew()) model.trigger('sync', model, resp, options);
      };

      var xhr = false;
      if (this.isNew()) {
        _.defer(options.success);
      } else {
        wrapError(this, options);
        xhr = this.sync('delete', this, options);
      }
      if (!wait) destroy();
      return xhr;
    },

    // Default URL for the model's representation on the server -- if you're
    // using Backbone's restful methods, override this to change the endpoint
    // that will be called.
    url: function() {
      var base =
        _.result(this, 'urlRoot') ||
        _.result(this.collection, 'url') ||
        urlError();
      if (this.isNew()) return base;
      var id = this.get(this.idAttribute);
      return base.replace(/[^\/]$/, '$&/') + encodeURIComponent(id);
    },

    // **parse** converts a response into the hash of attributes to be `set` on
    // the model. The default implementation is just to pass the response along.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new model with identical attributes to this one.
    clone: function() {
      return new this.constructor(this.attributes);
    },

    // A model is new if it has never been saved to the server, and lacks an id.
    isNew: function() {
      return !this.has(this.idAttribute);
    },

    // Check if the model is currently in a valid state.
    isValid: function(options) {
      return this._validate({}, _.extend({}, options, {validate: true}));
    },

    // Run validation against the next complete set of model attributes,
    // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
    _validate: function(attrs, options) {
      if (!options.validate || !this.validate) return true;
      attrs = _.extend({}, this.attributes, attrs);
      var error = this.validationError = this.validate(attrs, options) || null;
      if (!error) return true;
      this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
      return false;
    }

  });

  // Underscore methods that we want to implement on the Model, mapped to the
  // number of arguments they take.
  var modelMethods = {keys: 1, values: 1, pairs: 1, invert: 1, pick: 0,
      omit: 0, chain: 1, isEmpty: 1};

  // Mix in each Underscore method as a proxy to `Model#attributes`.
  addUnderscoreMethods(Model, modelMethods, 'attributes');

  // Backbone.Collection
  // -------------------

  // If models tend to represent a single row of data, a Backbone Collection is
  // more analogous to a table full of data ... or a small slice or page of that
  // table, or a collection of rows that belong together for a particular reason
  // -- all of the messages in this particular folder, all of the documents
  // belonging to this particular author, and so on. Collections maintain
  // indexes of their models, both in order, and for lookup by `id`.

  // Create a new **Collection**, perhaps to contain a specific type of `model`.
  // If a `comparator` is specified, the Collection will maintain
  // its models in sort order, as they're added and removed.
  var Collection = Backbone.Collection = function(models, options) {
    options || (options = {});
    if (options.model) this.model = options.model;
    if (options.comparator !== void 0) this.comparator = options.comparator;
    this._reset();
    this.initialize.apply(this, arguments);
    if (models) this.reset(models, _.extend({silent: true}, options));
  };

  // Default options for `Collection#set`.
  var setOptions = {add: true, remove: true, merge: true};
  var addOptions = {add: true, remove: false};

  // Splices `insert` into `array` at index `at`.
  var splice = function(array, insert, at) {
    at = Math.min(Math.max(at, 0), array.length);
    var tail = Array(array.length - at);
    var length = insert.length;
    var i;
    for (i = 0; i < tail.length; i++) tail[i] = array[i + at];
    for (i = 0; i < length; i++) array[i + at] = insert[i];
    for (i = 0; i < tail.length; i++) array[i + length + at] = tail[i];
  };

  // Define the Collection's inheritable methods.
  _.extend(Collection.prototype, Events, {

    // The default model for a collection is just a **Backbone.Model**.
    // This should be overridden in most cases.
    model: Model,

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // The JSON representation of a Collection is an array of the
    // models' attributes.
    toJSON: function(options) {
      return this.map(function(model) { return model.toJSON(options); });
    },

    // Proxy `Backbone.sync` by default.
    sync: function() {
      return Backbone.sync.apply(this, arguments);
    },

    // Add a model, or list of models to the set. `models` may be Backbone
    // Models or raw JavaScript objects to be converted to Models, or any
    // combination of the two.
    add: function(models, options) {
      return this.set(models, _.extend({merge: false}, options, addOptions));
    },

    // Remove a model, or a list of models from the set.
    remove: function(models, options) {
      options = _.extend({}, options);
      var singular = !_.isArray(models);
      models = singular ? [models] : models.slice();
      var removed = this._removeModels(models, options);
      if (!options.silent && removed.length) {
        options.changes = {added: [], merged: [], removed: removed};
        this.trigger('update', this, options);
      }
      return singular ? removed[0] : removed;
    },

    // Update a collection by `set`-ing a new list of models, adding new ones,
    // removing models that are no longer present, and merging models that
    // already exist in the collection, as necessary. Similar to **Model#set**,
    // the core operation for updating the data contained by the collection.
    set: function(models, options) {
      if (models == null) return;

      options = _.extend({}, setOptions, options);
      if (options.parse && !this._isModel(models)) {
        models = this.parse(models, options) || [];
      }

      var singular = !_.isArray(models);
      models = singular ? [models] : models.slice();

      var at = options.at;
      if (at != null) at = +at;
      if (at > this.length) at = this.length;
      if (at < 0) at += this.length + 1;

      var set = [];
      var toAdd = [];
      var toMerge = [];
      var toRemove = [];
      var modelMap = {};

      var add = options.add;
      var merge = options.merge;
      var remove = options.remove;

      var sort = false;
      var sortable = this.comparator && at == null && options.sort !== false;
      var sortAttr = _.isString(this.comparator) ? this.comparator : null;

      // Turn bare objects into model references, and prevent invalid models
      // from being added.
      var model, i;
      for (i = 0; i < models.length; i++) {
        model = models[i];

        // If a duplicate is found, prevent it from being added and
        // optionally merge it into the existing model.
        var existing = this.get(model);
        if (existing) {
          if (merge && model !== existing) {
            var attrs = this._isModel(model) ? model.attributes : model;
            if (options.parse) attrs = existing.parse(attrs, options);
            existing.set(attrs, options);
            toMerge.push(existing);
            if (sortable && !sort) sort = existing.hasChanged(sortAttr);
          }
          if (!modelMap[existing.cid]) {
            modelMap[existing.cid] = true;
            set.push(existing);
          }
          models[i] = existing;

        // If this is a new, valid model, push it to the `toAdd` list.
        } else if (add) {
          model = models[i] = this._prepareModel(model, options);
          if (model) {
            toAdd.push(model);
            this._addReference(model, options);
            modelMap[model.cid] = true;
            set.push(model);
          }
        }
      }

      // Remove stale models.
      if (remove) {
        for (i = 0; i < this.length; i++) {
          model = this.models[i];
          if (!modelMap[model.cid]) toRemove.push(model);
        }
        if (toRemove.length) this._removeModels(toRemove, options);
      }

      // See if sorting is needed, update `length` and splice in new models.
      var orderChanged = false;
      var replace = !sortable && add && remove;
      if (set.length && replace) {
        orderChanged = this.length !== set.length || _.some(this.models, function(m, index) {
          return m !== set[index];
        });
        this.models.length = 0;
        splice(this.models, set, 0);
        this.length = this.models.length;
      } else if (toAdd.length) {
        if (sortable) sort = true;
        splice(this.models, toAdd, at == null ? this.length : at);
        this.length = this.models.length;
      }

      // Silently sort the collection if appropriate.
      if (sort) this.sort({silent: true});

      // Unless silenced, it's time to fire all appropriate add/sort/update events.
      if (!options.silent) {
        for (i = 0; i < toAdd.length; i++) {
          if (at != null) options.index = at + i;
          model = toAdd[i];
          model.trigger('add', model, this, options);
        }
        if (sort || orderChanged) this.trigger('sort', this, options);
        if (toAdd.length || toRemove.length || toMerge.length) {
          options.changes = {
            added: toAdd,
            removed: toRemove,
            merged: toMerge
          };
          this.trigger('update', this, options);
        }
      }

      // Return the added (or merged) model (or models).
      return singular ? models[0] : models;
    },

    // When you have more items than you want to add or remove individually,
    // you can reset the entire set with a new list of models, without firing
    // any granular `add` or `remove` events. Fires `reset` when finished.
    // Useful for bulk operations and optimizations.
    reset: function(models, options) {
      options = options ? _.clone(options) : {};
      for (var i = 0; i < this.models.length; i++) {
        this._removeReference(this.models[i], options);
      }
      options.previousModels = this.models;
      this._reset();
      models = this.add(models, _.extend({silent: true}, options));
      if (!options.silent) this.trigger('reset', this, options);
      return models;
    },

    // Add a model to the end of the collection.
    push: function(model, options) {
      return this.add(model, _.extend({at: this.length}, options));
    },

    // Remove a model from the end of the collection.
    pop: function(options) {
      var model = this.at(this.length - 1);
      return this.remove(model, options);
    },

    // Add a model to the beginning of the collection.
    unshift: function(model, options) {
      return this.add(model, _.extend({at: 0}, options));
    },

    // Remove a model from the beginning of the collection.
    shift: function(options) {
      var model = this.at(0);
      return this.remove(model, options);
    },

    // Slice out a sub-array of models from the collection.
    slice: function() {
      return slice.apply(this.models, arguments);
    },

    // Get a model from the set by id, cid, model object with id or cid
    // properties, or an attributes object that is transformed through modelId.
    get: function(obj) {
      if (obj == null) return void 0;
      return this._byId[obj] ||
        this._byId[this.modelId(obj.attributes || obj)] ||
        obj.cid && this._byId[obj.cid];
    },

    // Returns `true` if the model is in the collection.
    has: function(obj) {
      return this.get(obj) != null;
    },

    // Get the model at the given index.
    at: function(index) {
      if (index < 0) index += this.length;
      return this.models[index];
    },

    // Return models with matching attributes. Useful for simple cases of
    // `filter`.
    where: function(attrs, first) {
      return this[first ? 'find' : 'filter'](attrs);
    },

    // Return the first model with matching attributes. Useful for simple cases
    // of `find`.
    findWhere: function(attrs) {
      return this.where(attrs, true);
    },

    // Force the collection to re-sort itself. You don't need to call this under
    // normal circumstances, as the set will maintain sort order as each item
    // is added.
    sort: function(options) {
      var comparator = this.comparator;
      if (!comparator) throw new Error('Cannot sort a set without a comparator');
      options || (options = {});

      var length = comparator.length;
      if (_.isFunction(comparator)) comparator = _.bind(comparator, this);

      // Run sort based on type of `comparator`.
      if (length === 1 || _.isString(comparator)) {
        this.models = this.sortBy(comparator);
      } else {
        this.models.sort(comparator);
      }
      if (!options.silent) this.trigger('sort', this, options);
      return this;
    },

    // Pluck an attribute from each model in the collection.
    pluck: function(attr) {
      return this.map(attr + '');
    },

    // Fetch the default set of models for this collection, resetting the
    // collection when they arrive. If `reset: true` is passed, the response
    // data will be passed through the `reset` method instead of `set`.
    fetch: function(options) {
      options = _.extend({parse: true}, options);
      var success = options.success;
      var collection = this;
      options.success = function(resp) {
        var method = options.reset ? 'reset' : 'set';
        collection[method](resp, options);
        if (success) success.call(options.context, collection, resp, options);
        collection.trigger('sync', collection, resp, options);
      };
      wrapError(this, options);
      return this.sync('read', this, options);
    },

    // Create a new instance of a model in this collection. Add the model to the
    // collection immediately, unless `wait: true` is passed, in which case we
    // wait for the server to agree.
    create: function(model, options) {
      options = options ? _.clone(options) : {};
      var wait = options.wait;
      model = this._prepareModel(model, options);
      if (!model) return false;
      if (!wait) this.add(model, options);
      var collection = this;
      var success = options.success;
      options.success = function(m, resp, callbackOpts) {
        if (wait) collection.add(m, callbackOpts);
        if (success) success.call(callbackOpts.context, m, resp, callbackOpts);
      };
      model.save(null, options);
      return model;
    },

    // **parse** converts a response into a list of models to be added to the
    // collection. The default implementation is just to pass it through.
    parse: function(resp, options) {
      return resp;
    },

    // Create a new collection with an identical list of models as this one.
    clone: function() {
      return new this.constructor(this.models, {
        model: this.model,
        comparator: this.comparator
      });
    },

    // Define how to uniquely identify models in the collection.
    modelId: function(attrs) {
      return attrs[this.model.prototype.idAttribute || 'id'];
    },

    // Private method to reset all internal state. Called when the collection
    // is first initialized or reset.
    _reset: function() {
      this.length = 0;
      this.models = [];
      this._byId  = {};
    },

    // Prepare a hash of attributes (or other model) to be added to this
    // collection.
    _prepareModel: function(attrs, options) {
      if (this._isModel(attrs)) {
        if (!attrs.collection) attrs.collection = this;
        return attrs;
      }
      options = options ? _.clone(options) : {};
      options.collection = this;
      var model = new this.model(attrs, options);
      if (!model.validationError) return model;
      this.trigger('invalid', this, model.validationError, options);
      return false;
    },

    // Internal method called by both remove and set.
    _removeModels: function(models, options) {
      var removed = [];
      for (var i = 0; i < models.length; i++) {
        var model = this.get(models[i]);
        if (!model) continue;

        var index = this.indexOf(model);
        this.models.splice(index, 1);
        this.length--;

        // Remove references before triggering 'remove' event to prevent an
        // infinite loop. #3693
        delete this._byId[model.cid];
        var id = this.modelId(model.attributes);
        if (id != null) delete this._byId[id];

        if (!options.silent) {
          options.index = index;
          model.trigger('remove', model, this, options);
        }

        removed.push(model);
        this._removeReference(model, options);
      }
      return removed;
    },

    // Method for checking whether an object should be considered a model for
    // the purposes of adding to the collection.
    _isModel: function(model) {
      return model instanceof Model;
    },

    // Internal method to create a model's ties to a collection.
    _addReference: function(model, options) {
      this._byId[model.cid] = model;
      var id = this.modelId(model.attributes);
      if (id != null) this._byId[id] = model;
      model.on('all', this._onModelEvent, this);
    },

    // Internal method to sever a model's ties to a collection.
    _removeReference: function(model, options) {
      delete this._byId[model.cid];
      var id = this.modelId(model.attributes);
      if (id != null) delete this._byId[id];
      if (this === model.collection) delete model.collection;
      model.off('all', this._onModelEvent, this);
    },

    // Internal method called every time a model in the set fires an event.
    // Sets need to update their indexes when models change ids. All other
    // events simply proxy through. "add" and "remove" events that originate
    // in other collections are ignored.
    _onModelEvent: function(event, model, collection, options) {
      if (model) {
        if ((event === 'add' || event === 'remove') && collection !== this) return;
        if (event === 'destroy') this.remove(model, options);
        if (event === 'change') {
          var prevId = this.modelId(model.previousAttributes());
          var id = this.modelId(model.attributes);
          if (prevId !== id) {
            if (prevId != null) delete this._byId[prevId];
            if (id != null) this._byId[id] = model;
          }
        }
      }
      this.trigger.apply(this, arguments);
    }

  });

  // Underscore methods that we want to implement on the Collection.
  // 90% of the core usefulness of Backbone Collections is actually implemented
  // right here:
  var collectionMethods = {forEach: 3, each: 3, map: 3, collect: 3, reduce: 0,
      foldl: 0, inject: 0, reduceRight: 0, foldr: 0, find: 3, detect: 3, filter: 3,
      select: 3, reject: 3, every: 3, all: 3, some: 3, any: 3, include: 3, includes: 3,
      contains: 3, invoke: 0, max: 3, min: 3, toArray: 1, size: 1, first: 3,
      head: 3, take: 3, initial: 3, rest: 3, tail: 3, drop: 3, last: 3,
      without: 0, difference: 0, indexOf: 3, shuffle: 1, lastIndexOf: 3,
      isEmpty: 1, chain: 1, sample: 3, partition: 3, groupBy: 3, countBy: 3,
      sortBy: 3, indexBy: 3, findIndex: 3, findLastIndex: 3};

  // Mix in each Underscore method as a proxy to `Collection#models`.
  addUnderscoreMethods(Collection, collectionMethods, 'models');

  // Backbone.View
  // -------------

  // Backbone Views are almost more convention than they are actual code. A View
  // is simply a JavaScript object that represents a logical chunk of UI in the
  // DOM. This might be a single item, an entire list, a sidebar or panel, or
  // even the surrounding frame which wraps your whole app. Defining a chunk of
  // UI as a **View** allows you to define your DOM events declaratively, without
  // having to worry about render order ... and makes it easy for the view to
  // react to specific changes in the state of your models.

  // Creating a Backbone.View creates its initial element outside of the DOM,
  // if an existing element is not provided...
  var View = Backbone.View = function(options) {
    this.cid = _.uniqueId('view');
    _.extend(this, _.pick(options, viewOptions));
    this._ensureElement();
    this.initialize.apply(this, arguments);
  };

  // Cached regex to split keys for `delegate`.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  // List of view options to be set as properties.
  var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

  // Set up all inheritable **Backbone.View** properties and methods.
  _.extend(View.prototype, Events, {

    // The default `tagName` of a View's element is `"div"`.
    tagName: 'div',

    // jQuery delegate for element lookup, scoped to DOM elements within the
    // current view. This should be preferred to global lookups where possible.
    $: function(selector) {
      return this.$el.find(selector);
    },

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // **render** is the core function that your view should override, in order
    // to populate its element (`this.el`), with the appropriate HTML. The
    // convention is for **render** to always return `this`.
    render: function() {
      return this;
    },

    // Remove this view by taking the element out of the DOM, and removing any
    // applicable Backbone.Events listeners.
    remove: function() {
      this._removeElement();
      this.stopListening();
      return this;
    },

    // Remove this view's element from the document and all event listeners
    // attached to it. Exposed for subclasses using an alternative DOM
    // manipulation API.
    _removeElement: function() {
      this.$el.remove();
    },

    // Change the view's element (`this.el` property) and re-delegate the
    // view's events on the new element.
    setElement: function(element) {
      this.undelegateEvents();
      this._setElement(element);
      this.delegateEvents();
      return this;
    },

    // Creates the `this.el` and `this.$el` references for this view using the
    // given `el`. `el` can be a CSS selector or an HTML string, a jQuery
    // context or an element. Subclasses can override this to utilize an
    // alternative DOM manipulation API and are only required to set the
    // `this.el` property.
    _setElement: function(el) {
      this.$el = el instanceof Backbone.$ ? el : Backbone.$(el);
      this.el = this.$el[0];
    },

    // Set callbacks, where `this.events` is a hash of
    //
    // *{"event selector": "callback"}*
    //
    //     {
    //       'mousedown .title':  'edit',
    //       'click .button':     'save',
    //       'click .open':       function(e) { ... }
    //     }
    //
    // pairs. Callbacks will be bound to the view, with `this` set properly.
    // Uses event delegation for efficiency.
    // Omitting the selector binds the event to `this.el`.
    delegateEvents: function(events) {
      events || (events = _.result(this, 'events'));
      if (!events) return this;
      this.undelegateEvents();
      for (var key in events) {
        var method = events[key];
        if (!_.isFunction(method)) method = this[method];
        if (!method) continue;
        var match = key.match(delegateEventSplitter);
        this.delegate(match[1], match[2], _.bind(method, this));
      }
      return this;
    },

    // Add a single event listener to the view's element (or a child element
    // using `selector`). This only works for delegate-able events: not `focus`,
    // `blur`, and not `change`, `submit`, and `reset` in Internet Explorer.
    delegate: function(eventName, selector, listener) {
      this.$el.on(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Clears all callbacks previously bound to the view by `delegateEvents`.
    // You usually don't need to use this, but may wish to if you have multiple
    // Backbone views attached to the same DOM element.
    undelegateEvents: function() {
      if (this.$el) this.$el.off('.delegateEvents' + this.cid);
      return this;
    },

    // A finer-grained `undelegateEvents` for removing a single delegated event.
    // `selector` and `listener` are both optional.
    undelegate: function(eventName, selector, listener) {
      this.$el.off(eventName + '.delegateEvents' + this.cid, selector, listener);
      return this;
    },

    // Produces a DOM element to be assigned to your view. Exposed for
    // subclasses using an alternative DOM manipulation API.
    _createElement: function(tagName) {
      return document.createElement(tagName);
    },

    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties.
    _ensureElement: function() {
      if (!this.el) {
        var attrs = _.extend({}, _.result(this, 'attributes'));
        if (this.id) attrs.id = _.result(this, 'id');
        if (this.className) attrs['class'] = _.result(this, 'className');
        this.setElement(this._createElement(_.result(this, 'tagName')));
        this._setAttributes(attrs);
      } else {
        this.setElement(_.result(this, 'el'));
      }
    },

    // Set attributes from a hash on this view's element.  Exposed for
    // subclasses using an alternative DOM manipulation API.
    _setAttributes: function(attributes) {
      this.$el.attr(attributes);
    }

  });

  // Backbone.sync
  // -------------

  // Override this function to change the manner in which Backbone persists
  // models to the server. You will be passed the type of request, and the
  // model in question. By default, makes a RESTful Ajax request
  // to the model's `url()`. Some possible customizations could be:
  //
  // * Use `setTimeout` to batch rapid-fire updates into a single request.
  // * Send up the models as XML instead of JSON.
  // * Persist models via WebSockets instead of Ajax.
  //
  // Turn on `Backbone.emulateHTTP` in order to send `PUT` and `DELETE` requests
  // as `POST`, with a `_method` parameter containing the true HTTP method,
  // as well as all requests with the body as `application/x-www-form-urlencoded`
  // instead of `application/json` with the model in a param named `model`.
  // Useful when interfacing with server-side languages like **PHP** that make
  // it difficult to read the body of `PUT` requests.
  Backbone.sync = function(method, model, options) {
    var type = methodMap[method];

    // Default options, unless specified.
    _.defaults(options || (options = {}), {
      emulateHTTP: Backbone.emulateHTTP,
      emulateJSON: Backbone.emulateJSON
    });

    // Default JSON-request options.
    var params = {type: type, dataType: 'json'};

    // Ensure that we have a URL.
    if (!options.url) {
      params.url = _.result(model, 'url') || urlError();
    }

    // Ensure that we have the appropriate request data.
    if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
      params.contentType = 'application/json';
      params.data = JSON.stringify(options.attrs || model.toJSON(options));
    }

    // For older servers, emulate JSON by encoding the request into an HTML-form.
    if (options.emulateJSON) {
      params.contentType = 'application/x-www-form-urlencoded';
      params.data = params.data ? {model: params.data} : {};
    }

    // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
    // And an `X-HTTP-Method-Override` header.
    if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
      params.type = 'POST';
      if (options.emulateJSON) params.data._method = type;
      var beforeSend = options.beforeSend;
      options.beforeSend = function(xhr) {
        xhr.setRequestHeader('X-HTTP-Method-Override', type);
        if (beforeSend) return beforeSend.apply(this, arguments);
      };
    }

    // Don't process data on a non-GET request.
    if (params.type !== 'GET' && !options.emulateJSON) {
      params.processData = false;
    }

    // Pass along `textStatus` and `errorThrown` from jQuery.
    var error = options.error;
    options.error = function(xhr, textStatus, errorThrown) {
      options.textStatus = textStatus;
      options.errorThrown = errorThrown;
      if (error) error.call(options.context, xhr, textStatus, errorThrown);
    };

    // Make the request, allowing the user to override any Ajax options.
    var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
    model.trigger('request', model, xhr, options);
    return xhr;
  };

  // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
  var methodMap = {
    'create': 'POST',
    'update': 'PUT',
    'patch': 'PATCH',
    'delete': 'DELETE',
    'read': 'GET'
  };

  // Set the default implementation of `Backbone.ajax` to proxy through to `$`.
  // Override this if you'd like to use a different library.
  Backbone.ajax = function() {
    return Backbone.$.ajax.apply(Backbone.$, arguments);
  };

  // Backbone.Router
  // ---------------

  // Routers map faux-URLs to actions, and fire events when routes are
  // matched. Creating a new one sets its `routes` hash, if not set statically.
  var Router = Backbone.Router = function(options) {
    options || (options = {});
    if (options.routes) this.routes = options.routes;
    this._bindRoutes();
    this.initialize.apply(this, arguments);
  };

  // Cached regular expressions for matching named param parts and splatted
  // parts of route strings.
  var optionalParam = /\((.*?)\)/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

  // Set up all inheritable **Backbone.Router** properties and methods.
  _.extend(Router.prototype, Events, {

    // Initialize is an empty function by default. Override it with your own
    // initialization logic.
    initialize: function(){},

    // Manually bind a single named route to a callback. For example:
    //
    //     this.route('search/:query/p:num', 'search', function(query, num) {
    //       ...
    //     });
    //
    route: function(route, name, callback) {
      if (!_.isRegExp(route)) route = this._routeToRegExp(route);
      if (_.isFunction(name)) {
        callback = name;
        name = '';
      }
      if (!callback) callback = this[name];
      var router = this;
      Backbone.history.route(route, function(fragment) {
        var args = router._extractParameters(route, fragment);
        if (router.execute(callback, args, name) !== false) {
          router.trigger.apply(router, ['route:' + name].concat(args));
          router.trigger('route', name, args);
          Backbone.history.trigger('route', router, name, args);
        }
      });
      return this;
    },

    // Execute a route handler with the provided parameters.  This is an
    // excellent place to do pre-route setup or post-route cleanup.
    execute: function(callback, args, name) {
      if (callback) callback.apply(this, args);
    },

    // Simple proxy to `Backbone.history` to save a fragment into the history.
    navigate: function(fragment, options) {
      Backbone.history.navigate(fragment, options);
      return this;
    },

    // Bind all defined routes to `Backbone.history`. We have to reverse the
    // order of the routes here to support behavior where the most general
    // routes can be defined at the bottom of the route map.
    _bindRoutes: function() {
      if (!this.routes) return;
      this.routes = _.result(this, 'routes');
      var route, routes = _.keys(this.routes);
      while ((route = routes.pop()) != null) {
        this.route(route, this.routes[route]);
      }
    },

    // Convert a route string into a regular expression, suitable for matching
    // against the current location hash.
    _routeToRegExp: function(route) {
      route = route.replace(escapeRegExp, '\\$&')
                   .replace(optionalParam, '(?:$1)?')
                   .replace(namedParam, function(match, optional) {
                     return optional ? match : '([^/?]+)';
                   })
                   .replace(splatParam, '([^?]*?)');
      return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
    },

    // Given a route, and a URL fragment that it matches, return the array of
    // extracted decoded parameters. Empty or unmatched parameters will be
    // treated as `null` to normalize cross-browser behavior.
    _extractParameters: function(route, fragment) {
      var params = route.exec(fragment).slice(1);
      return _.map(params, function(param, i) {
        // Don't decode the search params.
        if (i === params.length - 1) return param || null;
        return param ? decodeURIComponent(param) : null;
      });
    }

  });

  // Backbone.History
  // ----------------

  // Handles cross-browser history management, based on either
  // [pushState](http://diveintohtml5.info/history.html) and real URLs, or
  // [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
  // and URL fragments. If the browser supports neither (old IE, natch),
  // falls back to polling.
  var History = Backbone.History = function() {
    this.handlers = [];
    this.checkUrl = _.bind(this.checkUrl, this);

    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  };

  // Cached regex for stripping a leading hash/slash and trailing space.
  var routeStripper = /^[#\/]|\s+$/g;

  // Cached regex for stripping leading and trailing slashes.
  var rootStripper = /^\/+|\/+$/g;

  // Cached regex for stripping urls of hash.
  var pathStripper = /#.*$/;

  // Has the history handling already been started?
  History.started = false;

  // Set up all inheritable **Backbone.History** properties and methods.
  _.extend(History.prototype, Events, {

    // The default interval to poll for hash changes, if necessary, is
    // twenty times a second.
    interval: 50,

    // Are we at the app root?
    atRoot: function() {
      var path = this.location.pathname.replace(/[^\/]$/, '$&/');
      return path === this.root && !this.getSearch();
    },

    // Does the pathname match the root?
    matchRoot: function() {
      var path = this.decodeFragment(this.location.pathname);
      var rootPath = path.slice(0, this.root.length - 1) + '/';
      return rootPath === this.root;
    },

    // Unicode characters in `location.pathname` are percent encoded so they're
    // decoded for comparison. `%25` should not be decoded since it may be part
    // of an encoded parameter.
    decodeFragment: function(fragment) {
      return decodeURI(fragment.replace(/%25/g, '%2525'));
    },

    // In IE6, the hash fragment and search params are incorrect if the
    // fragment contains `?`.
    getSearch: function() {
      var match = this.location.href.replace(/#.*/, '').match(/\?.+/);
      return match ? match[0] : '';
    },

    // Gets the true hash value. Cannot use location.hash directly due to bug
    // in Firefox where location.hash will always be decoded.
    getHash: function(window) {
      var match = (window || this).location.href.match(/#(.*)$/);
      return match ? match[1] : '';
    },

    // Get the pathname and search params, without the root.
    getPath: function() {
      var path = this.decodeFragment(
        this.location.pathname + this.getSearch()
      ).slice(this.root.length - 1);
      return path.charAt(0) === '/' ? path.slice(1) : path;
    },

    // Get the cross-browser normalized URL fragment from the path or hash.
    getFragment: function(fragment) {
      if (fragment == null) {
        if (this._usePushState || !this._wantsHashChange) {
          fragment = this.getPath();
        } else {
          fragment = this.getHash();
        }
      }
      return fragment.replace(routeStripper, '');
    },

    // Start the hash change handling, returning `true` if the current URL matches
    // an existing route, and `false` otherwise.
    start: function(options) {
      if (History.started) throw new Error('Backbone.history has already been started');
      History.started = true;

      // Figure out the initial configuration. Do we need an iframe?
      // Is pushState desired ... is it available?
      this.options          = _.extend({root: '/'}, this.options, options);
      this.root             = this.options.root;
      this._wantsHashChange = this.options.hashChange !== false;
      this._hasHashChange   = 'onhashchange' in window && (document.documentMode === void 0 || document.documentMode > 7);
      this._useHashChange   = this._wantsHashChange && this._hasHashChange;
      this._wantsPushState  = !!this.options.pushState;
      this._hasPushState    = !!(this.history && this.history.pushState);
      this._usePushState    = this._wantsPushState && this._hasPushState;
      this.fragment         = this.getFragment();

      // Normalize root to always include a leading and trailing slash.
      this.root = ('/' + this.root + '/').replace(rootStripper, '/');

      // Transition from hashChange to pushState or vice versa if both are
      // requested.
      if (this._wantsHashChange && this._wantsPushState) {

        // If we've started off with a route from a `pushState`-enabled
        // browser, but we're currently in a browser that doesn't support it...
        if (!this._hasPushState && !this.atRoot()) {
          var rootPath = this.root.slice(0, -1) || '/';
          this.location.replace(rootPath + '#' + this.getPath());
          // Return immediately as browser will do redirect to new url
          return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
        } else if (this._hasPushState && this.atRoot()) {
          this.navigate(this.getHash(), {replace: true});
        }

      }

      // Proxy an iframe to handle location events if the browser doesn't
      // support the `hashchange` event, HTML5 history, or the user wants
      // `hashChange` but not `pushState`.
      if (!this._hasHashChange && this._wantsHashChange && !this._usePushState) {
        this.iframe = document.createElement('iframe');
        this.iframe.src = 'javascript:0';
        this.iframe.style.display = 'none';
        this.iframe.tabIndex = -1;
        var body = document.body;
        // Using `appendChild` will throw on IE < 9 if the document is not ready.
        var iWindow = body.insertBefore(this.iframe, body.firstChild).contentWindow;
        iWindow.document.open();
        iWindow.document.close();
        iWindow.location.hash = '#' + this.fragment;
      }

      // Add a cross-platform `addEventListener` shim for older browsers.
      var addEventListener = window.addEventListener || function(eventName, listener) {
        return attachEvent('on' + eventName, listener);
      };

      // Depending on whether we're using pushState or hashes, and whether
      // 'onhashchange' is supported, determine how we check the URL state.
      if (this._usePushState) {
        addEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        addEventListener('hashchange', this.checkUrl, false);
      } else if (this._wantsHashChange) {
        this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
      }

      if (!this.options.silent) return this.loadUrl();
    },

    // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
    // but possibly useful for unit testing Routers.
    stop: function() {
      // Add a cross-platform `removeEventListener` shim for older browsers.
      var removeEventListener = window.removeEventListener || function(eventName, listener) {
        return detachEvent('on' + eventName, listener);
      };

      // Remove window listeners.
      if (this._usePushState) {
        removeEventListener('popstate', this.checkUrl, false);
      } else if (this._useHashChange && !this.iframe) {
        removeEventListener('hashchange', this.checkUrl, false);
      }

      // Clean up the iframe if necessary.
      if (this.iframe) {
        document.body.removeChild(this.iframe);
        this.iframe = null;
      }

      // Some environments will throw when clearing an undefined interval.
      if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
      History.started = false;
    },

    // Add a route to be tested when the fragment changes. Routes added later
    // may override previous routes.
    route: function(route, callback) {
      this.handlers.unshift({route: route, callback: callback});
    },

    // Checks the current URL to see if it has changed, and if it has,
    // calls `loadUrl`, normalizing across the hidden iframe.
    checkUrl: function(e) {
      var current = this.getFragment();

      // If the user pressed the back button, the iframe's hash will have
      // changed and we should use that for comparison.
      if (current === this.fragment && this.iframe) {
        current = this.getHash(this.iframe.contentWindow);
      }

      if (current === this.fragment) return false;
      if (this.iframe) this.navigate(current);
      this.loadUrl();
    },

    // Attempt to load the current URL fragment. If a route succeeds with a
    // match, returns `true`. If no defined routes matches the fragment,
    // returns `false`.
    loadUrl: function(fragment) {
      // If the root doesn't match, no routes can match either.
      if (!this.matchRoot()) return false;
      fragment = this.fragment = this.getFragment(fragment);
      return _.some(this.handlers, function(handler) {
        if (handler.route.test(fragment)) {
          handler.callback(fragment);
          return true;
        }
      });
    },

    // Save a fragment into the hash history, or replace the URL state if the
    // 'replace' option is passed. You are responsible for properly URL-encoding
    // the fragment in advance.
    //
    // The options object can contain `trigger: true` if you wish to have the
    // route callback be fired (not usually desirable), or `replace: true`, if
    // you wish to modify the current URL without adding an entry to the history.
    navigate: function(fragment, options) {
      if (!History.started) return false;
      if (!options || options === true) options = {trigger: !!options};

      // Normalize the fragment.
      fragment = this.getFragment(fragment || '');

      // Don't include a trailing slash on the root.
      var rootPath = this.root;
      if (fragment === '' || fragment.charAt(0) === '?') {
        rootPath = rootPath.slice(0, -1) || '/';
      }
      var url = rootPath + fragment;

      // Strip the hash and decode for matching.
      fragment = this.decodeFragment(fragment.replace(pathStripper, ''));

      if (this.fragment === fragment) return;
      this.fragment = fragment;

      // If pushState is available, we use it to set the fragment as a real URL.
      if (this._usePushState) {
        this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
      } else if (this._wantsHashChange) {
        this._updateHash(this.location, fragment, options.replace);
        if (this.iframe && fragment !== this.getHash(this.iframe.contentWindow)) {
          var iWindow = this.iframe.contentWindow;

          // Opening and closing the iframe tricks IE7 and earlier to push a
          // history entry on hash-tag change.  When replace is true, we don't
          // want this.
          if (!options.replace) {
            iWindow.document.open();
            iWindow.document.close();
          }

          this._updateHash(iWindow.location, fragment, options.replace);
        }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
      } else {
        return this.location.assign(url);
      }
      if (options.trigger) return this.loadUrl(fragment);
    },

    // Update the hash location, either replacing the current entry, or adding
    // a new one to the browser history.
    _updateHash: function(location, fragment, replace) {
      if (replace) {
        var href = location.href.replace(/(javascript:|#).*$/, '');
        location.replace(href + '#' + fragment);
      } else {
        // Some browsers require that `hash` contains a leading #.
        location.hash = '#' + fragment;
      }
    }

  });

  // Create the default Backbone.history.
  Backbone.history = new History;

  // Helpers
  // -------

  // Helper function to correctly set up the prototype chain for subclasses.
  // Similar to `goog.inherits`, but uses a hash of prototype properties and
  // class properties to be extended.
  var extend = function(protoProps, staticProps) {
    var parent = this;
    var child;

    // The constructor function for the new subclass is either defined by you
    // (the "constructor" property in your `extend` definition), or defaulted
    // by us to simply call the parent constructor.
    if (protoProps && _.has(protoProps, 'constructor')) {
      child = protoProps.constructor;
    } else {
      child = function(){ return parent.apply(this, arguments); };
    }

    // Add static properties to the constructor function, if supplied.
    _.extend(child, parent, staticProps);

    // Set the prototype chain to inherit from `parent`, without calling
    // `parent`'s constructor function and add the prototype properties.
    child.prototype = _.create(parent.prototype, protoProps);
    child.prototype.constructor = child;

    // Set a convenience property in case the parent's prototype is needed
    // later.
    child.__super__ = parent.prototype;

    return child;
  };

  // Set up inheritance for the model, collection, router, view and history.
  Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

  // Throw an error when a URL is needed, and none is supplied.
  var urlError = function() {
    throw new Error('A "url" property or function must be specified');
  };

  // Wrap an optional error callback with a fallback error event.
  var wrapError = function(model, options) {
    var error = options.error;
    options.error = function(resp) {
      if (error) error.call(options.context, model, resp, options);
      model.trigger('error', model, resp, options);
    };
  };

  return Backbone;
});

var App = _.create(Object.prototype, {
	Views: _.create(Object.prototype, {}),
	Plugins: _.create(Object.prototype, {}),
	Control: {
		instance: function (options) {
			Backbone.View.call(this, options);
		},
		Delayed: {},
		install: function (options) {
			Backbone.$(function () {
				var pluginName = options.name;
				if (!_.isEmpty(App.Plugins[pluginName])) {
					console.error('Application error: "' + pluginName + '" plugin is already define.');
				}
				App.Plugins[pluginName] = options;
				if (!_.isEmpty(App.Control.Delayed[pluginName])) {
					_.each(App.Control.Delayed[pluginName], function (options, index) {
						App.Control.extend(pluginName, options);
						App.Control.Delayed[pluginName].splice(index, 1);
					});
				}
				if (!Backbone.$(options.el).length) {
					return false;
				}
				App.Views[pluginName] = [];
				var objArr = [];
				Backbone.$(options.el).each(function () {
					objArr.push(App.Control.construct(Backbone.$(this), options));
				});
				App.Views[pluginName] = objArr;
				return App.Views[pluginName];
			});
		},
		construct: function ($el, options) {
			var vOpts = _.extend(_.clone(options), {el: $el});
			var CAppViewInstance = this.instance.extend(vOpts);
			var CAppView = new CAppViewInstance;
			CAppView.initializeEx.apply(CAppView, arguments);
			$el.attr('cid', CAppView.cid);
			$el.addClass(options.name + 'Control');
			return CAppView;
		},
		extend: function (pluginName, options) {
			Backbone.$(function () {
				if (_.isEmpty(App.Plugins[pluginName])) {
					App.Control.Delayed[pluginName] = App.Control.Delayed[pluginName] || [];
					App.Control.Delayed[pluginName].push(options);
					setTimeout(function () {
						if (!_.isEmpty(App.Control.Delayed[pluginName])) {
							_.each(App.Control.Delayed[pluginName], function (options) {
								console.error('Application error: can not install "' + options.name + '" plugin. Extendable "' + pluginName + '" plugin is not define.');
							});
						}
					}, 3300);
					return;
				}
				App.Control.install(_.extend(_.clone(App.Plugins[pluginName]), options));
			});
		}
	}
});

var Fx = _.create(Object.prototype);

_.extend(App.Control.instance.prototype, Backbone.View.prototype, {
	initialize: function () { },
	initializeEx: function () { }
});

App.Control.instance.extend = Backbone.View.extend;

Backbone.$(function () {
	Backbone.$(document).ajaxComplete(function (event, request, settings) {
		_.each(App.Plugins, function (options) {
			Backbone.$(options.el).not('.' + options.name + 'Control').each(function () {
				App.Views[options.name] = App.Views[options.name] || [];
				App.Views[options.name].push(App.Control.construct(Backbone.$(this), options));
			});
		});
	});
});


if (!_(Fx).has('isTouch')) {
	Fx.isTouch = function () {
		return !!(('ontouchstart' in window)
		|| navigator.maxTouchPoints
		|| (window.DocumentTouch && document instanceof DocumentTouch));
	};
}

Parsley.addMessages('ru', {
	defaultMessage: 'Некорректное значение.',
	type: {
		email: 'Введите адрес электронной почты.',
		url: 'Введите URL адрес.',
		number: 'Введите число.',
		integer: 'Введите целое число.',
		digits: 'Введите только цифры.',
		alphanum: 'Введите буквенно-цифровое значение.'
	},
	notblank: 'Это поле должно быть заполнено.',
	required: 'Обязательное поле.',
	pattern: 'Это значение некорректно.',
	min: 'Это значение должно быть не менее чем %s.',
	max: 'Это значение должно быть не более чем %s.',
	range: 'Это значение должно быть от %s до %s.',
	minlength: 'Это значение должно содержать не менее %s символов.',
	maxlength: 'Это значение должно содержать не более %s символов.',
	length: 'Это значение должно содержать от %s до %s символов.',
	mincheck: 'Выберите не менее %s значений.',
	maxcheck: 'Выберите не более %s значений.',
	check: 'Выберите от %s до %s значений.',
	equalto: 'Это значение должно совпадать.',
	dateiso: 'Это значение должно быть корректной датой (ГГГГ-ММ-ДД).',
	minwords: 'Это значение должно содержать не менее %s слов.',
	maxwords: 'Это значение должно содержать не более %s слов.',
	words: 'Это значение должно содержать от %s до %s слов.',
	gt: 'Это значение должно быть больше.',
	gte: 'Это значение должно быть больше или равно.',
	lt: 'Это значение должно быть меньше.',
	lte: 'Это значение должно быть меньше или равно.',
	notequalto: 'Это значение должно отличаться.'
});

Parsley.setLocale('ru');

Parsley.addValidator('phone', {
	validateString: function (value, option, instance) {
		return instance.$element.inputmask('isComplete');
	}
});

Parsley.addValidator('mustchecked', {
	validateMultiple: function (value, option, instance) {
		return instance.$element.prop('checked');
	}
});