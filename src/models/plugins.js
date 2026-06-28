'use strict';

/**
 * Mongoose plugin: serialize documents the way the Flutter app expects.
 *   - expose `id` (string) instead of `_id`
 *   - drop `__v`
 * Apply ONLY to top-level models. Embedded sub-schemas should use
 * `{ _id: false }` so they don't get an id of their own.
 */
function jsonIdPlugin(schema) {
  schema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    },
  });
}

module.exports = { jsonIdPlugin };
