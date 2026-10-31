const { Prisma } = require("@prisma/client");

function getDatabaseSchema() {
  const models = Prisma.dmmf.datamodel.models;
  const enumValues = Object.fromEntries(
    Prisma.dmmf.datamodel.enums.map((item) => [item.name, item.values.map((value) => value.name)])
  );
  return models.map((m) => {
    const delegateName = m.name.charAt(0).toLowerCase() + m.name.slice(1);

    // Foreign-key columns on this table, mapped to what they point to.
    // relationFromFields is only populated on the "owning" side — the side
    // that actually stores the FK column — so reverse/list relations (e.g.
    // User.appointments) are naturally excluded here.
    const relations = m.fields
      .filter((f) => f.kind === "object" && f.relationFromFields && f.relationFromFields.length > 0)
      .map((f) => ({
        fkField: f.relationFromFields[0],
        relatedModel: f.type
      }));

    return {
      name: m.name,
      delegateName,
      tableName: m.dbName || m.name.toLowerCase() + "s",
      relations,
      fields: m.fields.map((f) => ({
        name: f.name,
        type: f.type,
        isId: f.isId,
        isRequired: f.isRequired,
        isList: f.isList,
        kind: f.kind,
        hasDefaultValue: f.hasDefaultValue,
        enumValues: f.kind === "enum" ? (enumValues[f.type] || []) : []
      }))
    };
  });
}

module.exports = { getDatabaseSchema };
