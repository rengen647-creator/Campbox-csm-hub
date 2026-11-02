'use strict';
/** In-memory deterministic reducer. Persistence must occur through an authenticated transactional service. */
function applyRevision(current, incoming) {
 if (!incoming || !incoming.eventKey || !Number.isSafeInteger(incoming.revision) || incoming.revision < 1) return {status:'reject',reason:'invalid_event',record:current||null};
 if (!current) return {status:'apply',reason:'new_event',record:{...incoming}};
 if (current.salesUserId !== incoming.salesUserId || current.contractKey !== incoming.contractKey || current.campId !== incoming.campId) return {status:'conflict',reason:'identity_mismatch',record:current};
 if (current.revision > incoming.revision) return {status:'skip',reason:'stale_revision',record:current};
 if (current.revision === incoming.revision) return {status:current.eventKey === incoming.eventKey ? 'skip' : 'conflict',reason:current.eventKey === incoming.eventKey ? 'replayed' : 'revision_collision',record:current};
 return {status:'apply',reason:'newer_revision',record:{...incoming}};
}
module.exports={applyRevision};
