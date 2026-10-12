const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Request and company ids are uuids; anything else is a broken link, answered as "not found" without a query. */
export const isUuid = (value: string) => UUID.test(value);
