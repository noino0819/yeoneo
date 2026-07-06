// 2단계 셋업 도우미: stationId·경유노선 실측 → constants/stops.ts 채우기
// 실행: npm run setup:constants [키워드]        → 정류소 후보 출력
//       npm run setup:constants -- --station <stationId> → 경유노선 출력
//       npm run setup:constants -- --route <routeId>     → 경유 정류장 순서 출력
import "./load-env";
import { searchStations, getStationRoutes, getRouteStations } from "../lib/ggbus";

const args = process.argv.slice(2);

async function main() {
  if (args[0] === "--station") {
    console.log(JSON.stringify(await getStationRoutes(args[1]), null, 2));
  } else if (args[0] === "--route") {
    console.log(JSON.stringify(await getRouteStations(args[1]), null, 2));
  } else {
    const keyword = args[0] ?? "동탄센트럴자이";
    console.log(JSON.stringify(await searchStations(keyword), null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
