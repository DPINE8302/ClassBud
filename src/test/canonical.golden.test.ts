import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain";

describe("independent canonical timetable golden fixture", () => {
  it("matches every official subject field", () => {
    const actual = createInitialState().subjects.map(({ id, code, nameTh, nameEn, teachers }) => [
      id, code, nameTh, nameEn, teachers.join("|"),
    ]);
    expect(actual).toEqual([
      ["art-9", "ศ32101", "ศิลปะ 9", "Art 9", "อ.ชญานิศ"],
      ["physical-science-2", "ว32103", "วิทยาศาสตร์กายภาพ 2", "Physical Science 2", "อ.โยธิชา"],
      ["3d-model-sculpting", "ว32297", "การปั้นโมเดล 3 มิติ", "3D Model Sculpting", "อ.คัทลียา"],
      ["guidance", "กน9", "แนะแนว", "Guidance", "อ.กัญญาพัชร"],
      ["game-design-development", "ว32274", "การออกแบบและพัฒนาเกม", "Game Design & Development", "ผศ.สุคนธ์|อ.คัทลียา"],
      ["mathematics-9", "ค32101", "คณิตศาสตร์ 9", "Mathematics 9", "อ.มลิธชา"],
      ["english-listening-speaking-3", "อ32221", "อังกฤษฟัง-พูดเพื่อสื่อสาร 3", "English Listening & Speaking 3", "อ.Diana|อ.พาขวัญ"],
      ["career-industry", "ง32101", "การงานอาชีพด้านอุตสาหกรรม", "Career Education: Industry", "อ.วัชชมา"],
      ["thai-9", "ท32101", "ภาษาไทย 9", "Thai 9", "อ.ดร.สุวิมล"],
      ["computer-programming-1", "ว30254", "การเขียนโปรแกรมคอมพิวเตอร์ 1", "Computer Programming 1", "อ.ธนภูมิ"],
      ["additional-mathematics-3", "ค32214", "คณิตศาสตร์เพิ่มเติม 3", "Additional Mathematics 3", "อ.มลิธชา"],
      ["english-9", "อ32101", "ภาษาอังกฤษ 9", "English 9", "อ.ดลพร"],
      ["social-studies-9", "ส32101", "สังคมศึกษา ศาสนาและวัฒนธรรม 9", "Social Studies, Religion and Culture 9", "อ.กิ่งกาญจน์"],
      ["physical-education-9", "พ32103", "พลศึกษา 9", "Physical Education 9", "อ.คัทลียา"],
      ["health-education-9", "พ32101", "สุขศึกษา 9", "Health Education 9", "อ.คัทลียา"],
    ]);
  });

  it("matches every official recurring session", () => {
    const actual = createInitialState().sessions.map(({ id, subjectId, weekday, periodIds, mode, room }) => [
      id, subjectId, weekday, periodIds.join("-"), mode, room ?? "",
    ]);
    expect(actual).toEqual([
      ["tue-art-9", "art-9", 2, "P1-P2", "flipped", ""],
      ["tue-physical-science-2", "physical-science-2", 2, "P3-P4", "classroom", "558"],
      ["tue-3d-model-sculpting", "3d-model-sculpting", 2, "P5-P6-P7", "classroom", "1903"],
      ["tue-guidance", "guidance", 2, "P8", "classroom", "1903"],
      ["wed-game-design-development", "game-design-development", 3, "P1-P2", "classroom", "1901"],
      ["wed-mathematics-9", "mathematics-9", 3, "P3-P4", "classroom", "1810"],
      ["wed-english-listening-speaking-3", "english-listening-speaking-3", 3, "P5-P6", "classroom", "525"],
      ["wed-career-industry", "career-industry", 3, "P7-P8", "flipped", ""],
      ["thu-thai-9", "thai-9", 4, "P1-P2", "classroom", "1209"],
      ["thu-game-design-development", "game-design-development", 4, "P3-P4", "classroom", "1901"],
      ["thu-computer-programming-1", "computer-programming-1", 4, "P5-P6", "classroom", "1901"],
      ["thu-additional-mathematics-3", "additional-mathematics-3", 4, "P7-P8", "classroom", "1712"],
      ["fri-additional-mathematics-3", "additional-mathematics-3", 5, "P1-P2", "classroom", "555"],
      ["fri-english-9", "english-9", 5, "P3-P4", "classroom", "555"],
      ["fri-social-studies-9", "social-studies-9", 5, "P5-P6", "classroom", "555"],
      ["fri-physical-education-9", "physical-education-9", 5, "P7", "self-study", ""],
      ["fri-health-education-9", "health-education-9", 5, "P8", "self-study", ""],
    ]);
  });
});
