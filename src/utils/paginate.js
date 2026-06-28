'use strict';

/**
 * Opt-in pagination helper.
 *
 * Pagination only kicks in when the request carries a `page` query param, so
 * existing callers that fetch a full list keep working unchanged. When `page`
 * is present we clamp `page`/`limit` to sane bounds and return the Mongo
 * skip/limit to apply.
 *
 * @returns {{page:number, limit:number, skip:number} | null}
 *   null when no pagination was requested.
 */
function pageParams(req, { defaultLimit = 20, maxLimit = 100 } = {}) {
  if (req.query.page === undefined) return null;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(req.query.limit, 10) || defaultLimit)
  );
  return { page, limit, skip: (page - 1) * limit };
}

/** Build the pagination envelope returned alongside `data`. */
function pageMeta({ page, limit }, total) {
  return { page, limit, total, hasMore: page * limit < total };
}

module.exports = { pageParams, pageMeta };
