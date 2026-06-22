export function isProjectCrmDataComplete(input: {
  targetGoLiveDate?: Date | string | null;
  goLiveDate?: Date | string | null;
  arrAmount?: number | null;
}): boolean {
  const goLive = input.targetGoLiveDate ?? input.goLiveDate ?? null;
  const hasGoLive =
    goLive instanceof Date
      ? !Number.isNaN(goLive.getTime())
      : typeof goLive === 'string' && goLive.trim().length > 0;
  const hasArr = input.arrAmount != null && Number.isFinite(input.arrAmount);
  return hasGoLive && hasArr;
}
