// deepmerge 4.3.1 (MIT, https://github.com/TehShrike/deepmerge), with
// GHSA-gcqx-w48m-w2h4 fixed: every key is written with defineProperty, so an
// own `__proto__` key in an input becomes a plain key on the result instead of
// replacing its prototype. No fixed release exists upstream; the root
// `overrides` send every dependent here. Drop it when upstream ships a fix.
'use strict'

const REACT_ELEMENT = Symbol.for('react.element')

const isSpecial = (value) => {
  const tag = Object.prototype.toString.call(value)
  return tag === '[object RegExp]' || tag === '[object Date]' || value.$$typeof === REACT_ELEMENT
}

const defaultIsMergeableObject = (value) => !!value && typeof value === 'object' && !isSpecial(value)

const emptyTarget = (value) => (Array.isArray(value) ? [] : {})

const define = (object, key, value) =>
  Object.defineProperty(object, key, { value, enumerable: true, writable: true, configurable: true })

function cloneUnlessOtherwiseSpecified(value, options) {
  return options.clone !== false && options.isMergeableObject(value)
    ? deepmerge(emptyTarget(value), value, options)
    : value
}

const defaultArrayMerge = (target, source, options) =>
  target.concat(source).map((element) => cloneUnlessOtherwiseSpecified(element, options))

function getMergeFunction(key, options) {
  const custom = options.customMerge?.(key)
  return typeof custom === 'function' ? custom : deepmerge
}

const getKeys = (target) =>
  Object.keys(target).concat(
    Object.getOwnPropertySymbols(target).filter((symbol) => Object.prototype.propertyIsEnumerable.call(target, symbol)),
  )

function propertyIsOnObject(object, property) {
  try {
    return property in object
  } catch {
    return false
  }
}

// A key inherited or non-enumerable on the target is never merged into.
const propertyIsUnsafe = (target, key) =>
  propertyIsOnObject(target, key) &&
  !(Object.hasOwn(target, key) && Object.prototype.propertyIsEnumerable.call(target, key))

function mergeObject(target, source, options) {
  const destination = {}
  if (options.isMergeableObject(target)) {
    for (const key of getKeys(target)) define(destination, key, cloneUnlessOtherwiseSpecified(target[key], options))
  }
  for (const key of getKeys(source)) {
    if (propertyIsUnsafe(target, key)) continue
    if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
      define(destination, key, getMergeFunction(key, options)(target[key], source[key], options))
    } else {
      define(destination, key, cloneUnlessOtherwiseSpecified(source[key], options))
    }
  }
  return destination
}

function deepmerge(target, source, given) {
  const options = given || {}
  options.arrayMerge = options.arrayMerge || defaultArrayMerge
  options.isMergeableObject = options.isMergeableObject || defaultIsMergeableObject
  // Custom arrayMerge implementations may call it; callers cannot replace it.
  options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified

  const sourceIsArray = Array.isArray(source)
  if (sourceIsArray !== Array.isArray(target)) return cloneUnlessOtherwiseSpecified(source, options)
  if (sourceIsArray) return options.arrayMerge(target, source, options)
  return mergeObject(target, source, options)
}

deepmerge.all = (array, options) => {
  if (!Array.isArray(array)) throw new Error('first argument should be an array')
  return array.reduce((prev, next) => deepmerge(prev, next, options), {})
}

module.exports = deepmerge
