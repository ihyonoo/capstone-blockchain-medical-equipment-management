// 태그 ID는 iBeacon의 `uuid:major:minor` 형식이다. uuid는 모든 태그가 공유하는 값이라
// 화면에서 장비를 구분해주지 못하므로, 실제로 태그를 식별하는 major/minor만 보여준다.
export type IBeaconTagParts = {
  major: string;
  minor: string;
};

export function parseIBeaconTag(tagId: string): IBeaconTagParts | null {
  const parts = tagId.split(':');
  if (parts.length !== 3) return null;
  const [, major, minor] = parts;
  if (!major || !minor) return null;
  return { major, minor };
}

export function formatIBeaconTag(tagId: string): string {
  if (!tagId) return '-';
  const parts = parseIBeaconTag(tagId);
  if (!parts) return tagId;
  return `major ${parts.major} · minor ${parts.minor}`;
}
