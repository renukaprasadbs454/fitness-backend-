// Turns a foreign-key column (e.g. Appointment.userId) into something a
// human can actually read in the admin/coach database explorers, instead of
// a bare UUID. Only related models that a FK in the schema actually points
// to need an entry here — see relations[].relatedModel from dbIntrospection.

const RELATION_LABEL_CONFIG = {
  User: {
    select: { fullName: true, email: true },
    label: (row) => `${row.fullName} (${row.email})`
  },
  Coach: {
    select: { user: { select: { fullName: true } } },
    label: (row) => (row.user ? `${row.user.fullName} — Coach` : "Coach")
  },
  WorkoutPlan: {
    select: { title: true },
    label: (row) => row.title
  },
  Exercise: {
    select: { name: true },
    label: (row) => row.name
  },
  ContentCategory: {
    select: { name: true },
    label: (row) => row.name
  },
  CustomWorkout: {
    select: { title: true },
    label: (row) => row.title
  },
  ChatRoom: {
    select: {
      user: { select: { fullName: true } },
      coach: { select: { user: { select: { fullName: true } } } }
    },
    label: (row) => `${row.user?.fullName ?? "?"} ↔ ${row.coach?.user?.fullName ?? "?"}`
  }
};

function delegateNameFor(modelName) {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

// Attaches a `${fkField}__label` string to every row for each FK column the
// model has a label config for. Leaves rows untouched for FK columns with no
// config (falls back to showing the raw id in the UI).
async function resolveRelationLabels(prisma, modelInfo, rows) {
  if (!modelInfo.relations?.length || !rows.length) return rows;

  const enriched = rows.map((r) => ({ ...r }));

  for (const rel of modelInfo.relations) {
    const config = RELATION_LABEL_CONFIG[rel.relatedModel];
    if (!config) continue;

    const ids = [...new Set(rows.map((r) => r[rel.fkField]).filter(Boolean))];
    if (!ids.length) continue;

    const delegate = prisma[delegateNameFor(rel.relatedModel)];
    if (!delegate) continue;

    const relatedRows = await delegate
      .findMany({ where: { id: { in: ids } }, select: { id: true, ...config.select } })
      .catch(() => []);

    const labelById = new Map(relatedRows.map((rr) => [rr.id, config.label(rr)]));

    enriched.forEach((row) => {
      const fkValue = row[rel.fkField];
      row[`${rel.fkField}__label`] = fkValue ? (labelById.get(fkValue) ?? null) : null;
    });
  }

  return enriched;
}

// Full option list for a related model, for populating a FK picker <select>
// in the insert/edit form — {id, label} pairs.
async function getRelationOptions(prisma, modelName) {
  const config = RELATION_LABEL_CONFIG[modelName];
  const delegate = prisma[delegateNameFor(modelName)];
  if (!delegate) return [];

  const select = { id: true, ...(config?.select || {}) };
  const rows = await delegate.findMany({ select, take: 500 }).catch(() => []);

  return rows.map((row) => ({
    id: row.id,
    label: config ? config.label(row) : row.id
  }));
}

module.exports = { RELATION_LABEL_CONFIG, resolveRelationLabels, getRelationOptions };
