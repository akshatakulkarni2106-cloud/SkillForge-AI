const ROLES = require('../utils/roles');
// strong: current >= required | learn: current < 30 | improve: everything between
exports.analyze = (req, res) => {
  const role = ROLES[req.query.role] ? req.query.role : req.user.targetRole; const have = Object.fromEntries(req.user.skills.map((s) => [s.name, s.score]));
  const rows = Object.entries(ROLES[role] || {}).map(([skill, required]) => { const current = have[skill] || 0;
    return { skill, current, required, status: current >= required ? 'strong' : current < 30 ? 'learn' : 'improve' }; });
  res.json({ role, roles: Object.keys(ROLES), rows });
};
