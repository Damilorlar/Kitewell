export function pageBuilderAddresses(addresses, start, limit) {
  const rows = addresses.slice(0, limit);
  return {
    rows,
    nextStart: addresses.length > limit ? start + limit : null,
  };
}

export function appendBuilderPage(previous, page, contractId) {
  if (
    !previous ||
    previous.contractId !== contractId ||
    previous.nextStart !== page.start
  ) {
    return { ...page, contractId };
  }

  return {
    ...page,
    start: previous.start,
    rows: [...previous.rows, ...page.rows],
    contractId,
  };
}

export function isBuilderCountMismatch(loadedCount, builderCount, nextStart) {
  if (!Number.isSafeInteger(builderCount) || builderCount < 0) return false;
  return (
    loadedCount > builderCount ||
    (nextStart === null && loadedCount !== builderCount)
  );
}
