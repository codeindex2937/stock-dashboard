function convertTime (time) {
    const [amt, t = 'ms'] = String(time).split(/(ms|s)/i)
    const types = {
      ms: 1,
      s: 1000
    }
  
    return Number(amt) * types[t]
  }
  
  function debounce (fn, wait) {
    let timeout = null
    const timer = typeof wait === 'number' ? wait : convertTime(wait)
  
    const debounced = function (...args) {
      const later = () => {
        timeout = null
  
        fn.apply(this, args)
      }
  
      clearTimeout(timeout)
      timeout = setTimeout(later, timer)
  
      if (!timeout) {
        fn.apply(this, args)
      }
    }
  
    debounced.cancel = () => {
      clearTimeout(timeout)
      timeout = null
    }
  
    return debounced
  }
  
// Helper Functions
/**
 * Maps through an array of strings and lowercases all of them
 * @param {Array} list an array of strings to map through
 */
function toLowerMap (list) {
  return list.map(x => x.toLowerCase())
}

/**
 * Takes in a value and ensures its wrapped within an array
 * @param {Any} value The value to ensure is an array
 */
function ensureArray (value) {
  if (Array.isArray(value)) {
    return value
  }

  if (value == null) {
    return []
  }

  return [value]
}

// Figures out the event we are using with the bound element
function mapOutListeningEvents (attrs, listenTo) {
  const { value = false } = attrs.getNamedItem('debounce-events') || {}

  // If they set an events attribute that overwrites everything
  if (value) {
    return toLowerMap(value.split(','))
  }

  return toLowerMap(ensureArray(listenTo))
}

function isEmpty (str) {
  return str === ''
}

function isCanceled (inputValue, modifiers) {
  return isEmpty(inputValue) && modifiers.cancelonempty
}

function isLocked (key, modifiers) {
  return key === 'Enter' && (!modifiers.lock || modifiers.unlock)
}

function shouldFireOnEmpty (inputValue, modifiers) {
  return isEmpty(inputValue) && modifiers.fireonempty
}

function determineVersion (v) {
  const [major] = v.split('.')

  if (Number(major) >= 3) {
    return 'mounted'
  }

  return 'bind'
}

export { debounce }

export default {
  install (Vue, {
    lock = false,
    listenTo = 'keyup',
    defaultTime = '300ms',
    fireOnEmpty = false,
    cancelOnEmpty = false
  } = {}) {
    Vue.directive('debounce', {
      [determineVersion(Vue.version)] (el, {
        value: debouncedFn,
        arg: timer = defaultTime,
        modifiers
      }) {
        const combinedRules = Object.assign({ fireonempty: fireOnEmpty, cancelonempty: cancelOnEmpty, lock }, modifiers)
        const listener = mapOutListeningEvents(el.attributes, listenTo)
        const fn = debounce(e => {
          debouncedFn(e.target.value, e)
        }, timer)

        function handler (event) {
          if (isCanceled(event.target.value, combinedRules)) {
            fn.cancel()
          } else if (isLocked(event.key, combinedRules) || shouldFireOnEmpty(event.target.value, combinedRules)) {
            fn.cancel()
            debouncedFn(event.target.value, event)
          } else {
            fn(event)
          }
        }

        listener.forEach(e => {
          el.addEventListener(e, handler)
        })
      }
    })
  }
}