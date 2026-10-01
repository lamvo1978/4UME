namespace FourUme.Application.Grammar;

public static class GrammarCatalog
{
    public sealed record ExerciseDef(
        string Id,
        string Type,
        string Prompt,
        IReadOnlyList<string>? Options,
        string Answer,
        string Explanation);

    public sealed record LessonDef(
        string Slug,
        string TitleVi,
        string Level,
        string SummaryVi,
        string Formula,
        string Example,
        string CommonMistakeVi,
        IReadOnlyList<ExerciseDef> Exercises);

    public static IReadOnlyList<LessonDef> Lessons { get; } =
    [
        new("to-be", "Động từ to be", "A1",
            "Dùng am/is/are để nói về danh tính, trạng thái, nghề nghiệp.",
            "S + am/is/are + ...",
            "I am a student. She is happy.",
            "Người Việt hay bỏ be: \"I student\" → \"I am a student\".",
            [
                new("tb1", "mcq", "I ____ a teacher.", ["am", "is", "are"], "am", "I đi với am."),
                new("tb2", "mcq", "She ____ at home.", ["am", "is", "are"], "is", "She/He/It đi với is."),
                new("tb3", "mcq", "They ____ friends.", ["am", "is", "are"], "are", "They/We/You đi với are."),
                new("tb4", "fill", "We ____ late.", null, "are", "We + are."),
                new("tb5", "mcq", "____ you ready?", ["Am", "Is", "Are"], "Are", "Câu hỏi: Are you...?"),
                new("tb6", "fill", "He ____ tired.", null, "is", "He + is."),
                new("tb7", "mcq", "It ____ cold today.", ["am", "is", "are"], "is", "It + is."),
                new("tb8", "fill", "You ____ kind.", null, "are", "You + are.")
            ]),
        new("present-simple", "Hiện tại đơn", "A1",
            "Diễn tả thói quen, sự thật hiển nhiên.",
            "S + V(s/es) / do-does + not",
            "She goes to school every day.",
            "Quên -s/-es với ngôi thứ ba: \"She go\" → \"She goes\".",
            [
                new("ps1", "mcq", "She ____ to school every day.", ["goes", "go", "going"], "goes", "Ngôi thứ ba thêm -es."),
                new("ps2", "mcq", "I ____ coffee in the morning.", ["drink", "drinks", "drinking"], "drink", "I dùng động từ nguyên mẫu."),
                new("ps3", "fill", "He ____ English.", null, "speaks", "He + speaks."),
                new("ps4", "mcq", "They ____ football on Sundays.", ["play", "plays", "playing"], "play", "They + play."),
                new("ps5", "mcq", "____ she like tea?", ["Do", "Does", "Is"], "Does", "Câu hỏi ngôi 3: Does."),
                new("ps6", "fill", "We ____ in Hanoi.", null, "live", "We + live."),
                new("ps7", "mcq", "The sun ____ in the east.", ["rise", "rises", "rising"], "rises", "Sự thật hiển nhiên, ngôi 3."),
                new("ps8", "fill", "My brother ____ TV every night.", null, "watches", "Brother + watches.")
            ]),
        new("present-continuous", "Hiện tại tiếp diễn", "A1",
            "Hành động đang xảy ra lúc nói.",
            "S + am/is/are + V-ing",
            "I am reading a book now.",
            "Dùng hiện tại đơn thay vì tiếp diễn khi đang nói về \"now\".",
            [
                new("pc1", "mcq", "I ____ reading now.", ["am", "is", "are"], "am", "I + am + V-ing."),
                new("pc2", "mcq", "She is ____ dinner.", ["cook", "cooking", "cooks"], "cooking", "Cần V-ing."),
                new("pc3", "fill", "They ____ playing outside.", null, "are", "They + are."),
                new("pc4", "mcq", "Look! It ____ raining.", ["is", "are", "am"], "is", "It + is."),
                new("pc5", "fill", "We are ____ English.", null, "studying", "are + studying."),
                new("pc6", "mcq", "He ____ working today.", ["am not", "is not", "are not"], "is not", "He + is not."),
                new("pc7", "mcq", "____ you listening?", ["Am", "Is", "Are"], "Are", "Are you + V-ing?"),
                new("pc8", "fill", "The children are ____.", null, "sleeping", "are + sleeping.")
            ]),
        new("past-simple", "Quá khứ đơn", "A2",
            "Hành động đã xảy ra và kết thúc trong quá khứ.",
            "S + V2 / did + not + V",
            "I visited Hue last year.",
            "Dùng hiện tại khi kể chuyện quá khứ; quên dạng bất quy tắc.",
            [
                new("pa1", "mcq", "I ____ home yesterday.", ["go", "went", "gone"], "went", "Go → went."),
                new("pa2", "mcq", "She ____ a movie last night.", ["watch", "watched", "watches"], "watched", "Động từ có quy tắc + ed."),
                new("pa3", "fill", "They ____ dinner at 7.", null, "had", "Have → had."),
                new("pa4", "mcq", "____ you see him?", ["Do", "Did", "Does"], "Did", "Câu hỏi quá khứ: Did."),
                new("pa5", "fill", "He ____ not come.", null, "did", "Phủ định: did not."),
                new("pa6", "mcq", "We ____ to Da Nang in 2020.", ["move", "moved", "moving"], "moved", "Past simple có quy tắc."),
                new("pa7", "mcq", "I ____ my keys.", ["lose", "lost", "losing"], "lost", "Lose → lost."),
                new("pa8", "fill", "She ____ happy yesterday.", null, "was", "Be quá khứ: was/were.")
            ]),
        new("future", "Tương lai (will / be going to)", "A2",
            "will: quyết định tức thì / dự đoán; be going to: kế hoạch đã có.",
            "S + will + V / S + am/is/are going to + V",
            "I will help you. I am going to study tonight.",
            "Dùng will cho mọi kế hoạch; nên phân biệt với be going to.",
            [
                new("fu1", "mcq", "I ____ help you.", ["will", "am", "do"], "will", "Quyết định tức thì: will."),
                new("fu2", "mcq", "She is ____ to travel next month.", ["go", "going", "goes"], "going", "be going to."),
                new("fu3", "fill", "They will ____ soon.", null, "arrive", "will + V nguyên mẫu."),
                new("fu4", "mcq", "Look at those clouds. It ____ rain.", ["will", "is going to", "goes"], "is going to", "Dấu hiệu rõ → be going to."),
                new("fu5", "fill", "I am going to ____ English.", null, "learn", "going to + V."),
                new("fu6", "mcq", "____ you come tomorrow?", ["Will", "Do", "Are"], "Will", "Will you + V?"),
                new("fu7", "mcq", "He ____ call you later.", ["will", "going", "is"], "will", "will + call."),
                new("fu8", "fill", "We are going to ____ a cake.", null, "make", "going to + make.")
            ]),
        new("articles", "Mạo từ a / an / the", "A1",
            "a/an: chưa xác định; the: đã xác định hoặc duy nhất.",
            "a + phụ âm; an + nguyên âm (âm)",
            "I have a book. The book is new.",
            "Hay bỏ mạo từ hoặc dùng the khi chưa nhắc đến trước.",
            [
                new("ar1", "mcq", "I bought ____ apple.", ["a", "an", "the"], "an", "apple bắt đầu bằng nguyên âm."),
                new("ar2", "mcq", "She is ____ doctor.", ["a", "an", "the"], "a", "Nghề nghiệp số ít: a."),
                new("ar3", "fill", "Open ____ window, please.", null, "the", "Cửa sổ cụ thể trong phòng: the."),
                new("ar4", "mcq", "I saw ____ interesting film.", ["a", "an", "the"], "an", "interesting bắt đầu bằng /ɪ/."),
                new("ar5", "mcq", "____ sun is bright.", ["A", "An", "The"], "The", "Vật duy nhất: the."),
                new("ar6", "fill", "He has ____ cat.", null, "a", "Chưa xác định: a."),
                new("ar7", "mcq", "This is ____ best cafe here.", ["a", "an", "the"], "the", "So sánh nhất: the."),
                new("ar8", "fill", "I need ____ umbrella.", null, "an", "umbrella → an.")
            ]),
        new("pronouns-plural", "Đại từ và số nhiều", "A1",
            "Đại từ thay danh từ; danh từ số nhiều thường thêm -s/-es.",
            "I/you/he/she/it/we/they · noun + s/es",
            "These books are mine. They are new.",
            "Dùng this với số nhiều; quên đổi are/they.",
            [
                new("pp1", "mcq", "____ is my sister.", ["He", "She", "They"], "She", "Chị/em gái → She."),
                new("pp2", "mcq", "The books ____ on the table.", ["is", "are", "am"], "are", "Số nhiều + are."),
                new("pp3", "fill", "____ are students.", null, "They", "Nhiều người → They."),
                new("pp4", "mcq", "This bag is ____.", ["I", "me", "mine"], "mine", "Tính từ sở hữu độc lập: mine."),
                new("pp5", "fill", "Two ____ are waiting.", null, "buses", "bus → buses."),
                new("pp6", "mcq", "____ apples look fresh.", ["This", "These", "That"], "These", "Số nhiều gần: these."),
                new("pp7", "mcq", "Give ____ the keys.", ["he", "him", "his"], "him", "Tân ngữ: him."),
                new("pp8", "fill", "The ____ are sleeping.", null, "children", "child → children.")
            ]),
        new("prepositions", "Giới từ thời gian và nơi chốn", "A2",
            "in/on/at cho thời gian; in/on/at/under... cho nơi chốn.",
            "at + giờ; on + ngày; in + tháng/năm",
            "I wake up at 6. The book is on the table.",
            "Nhầm at/in/on rất phổ biến.",
            [
                new("pr1", "mcq", "I get up ____ 6 a.m.", ["in", "on", "at"], "at", "Giờ → at."),
                new("pr2", "mcq", "We meet ____ Monday.", ["in", "on", "at"], "on", "Ngày trong tuần → on."),
                new("pr3", "fill", "She was born ____ 1999.", null, "in", "Năm → in."),
                new("pr4", "mcq", "The keys are ____ the table.", ["in", "on", "at"], "on", "Trên bề mặt → on."),
                new("pr5", "fill", "He lives ____ Hanoi.", null, "in", "Thành phố → in."),
                new("pr6", "mcq", "I will see you ____ the weekend.", ["in", "on", "at"], "at", "at the weekend (BrE/common learner)."),
                new("pr7", "mcq", "There is a cat ____ the box.", ["in", "on", "at"], "in", "Bên trong → in."),
                new("pr8", "fill", "The picture is ____ the wall.", null, "on", "Trên tường → on.")
            ]),
        new("comparatives", "So sánh hơn và nhất", "A2",
            "Tính từ ngắn: -er/-est; dài: more/most; bất quy tắc good→better→best.",
            "adj-er than / the adj-est · more/most + adj",
            "This cafe is quieter than that one. She is the best student.",
            "Dùng more với tính từ ngắn: \"more big\" → \"bigger\".",
            [
                new("co1", "mcq", "This bag is ____ than that one.", ["cheap", "cheaper", "cheapest"], "cheaper", "So sánh hơn ngắn: -er."),
                new("co2", "mcq", "She is the ____ student.", ["good", "better", "best"], "best", "good → best."),
                new("co3", "fill", "Today is ____ than yesterday.", null, "hotter", "hot → hotter."),
                new("co4", "mcq", "This book is ____ interesting.", ["more", "most", "much"], "more", "Tính từ dài: more."),
                new("co5", "fill", "He is the ____ in the class.", null, "tallest", "So sánh nhất: -est."),
                new("co6", "mcq", "My car is ____ than yours.", ["bad", "worse", "worst"], "worse", "bad → worse."),
                new("co7", "mcq", "English is ____ than I thought.", ["easy", "easier", "easiest"], "easier", "easy → easier."),
                new("co8", "fill", "This is the ____ beautiful place.", null, "most", "most + beautiful.")
            ]),
        new("questions-modals", "Câu hỏi và can / must / should", "A2",
            "Câu hỏi Yes/No và Wh-; modal + V nguyên mẫu.",
            "Do/Does/Did + S + V? · Modal + V",
            "Can you swim? You should rest.",
            "Thêm to sau modal: \"can to go\" → \"can go\".",
            [
                new("qm1", "mcq", "____ you swim?", ["Can", "Do can", "Are"], "Can", "Can + S + V?"),
                new("qm2", "mcq", "You ____ wear a helmet.", ["must", "must to", "musting"], "must", "must + V."),
                new("qm3", "fill", "You should ____ more water.", null, "drink", "should + V."),
                new("qm4", "mcq", "Where ____ she live?", ["do", "does", "is"], "does", "Wh- + does + S + V."),
                new("qm5", "fill", "____ you like coffee?", null, "Do", "Do you + V?"),
                new("qm6", "mcq", "He ____ drive yet.", ["can not", "cannot", "cans not"], "cannot", "Phủ định can: cannot/can't."),
                new("qm7", "mcq", "What ____ your name?", ["is", "are", "do"], "is", "What is...?"),
                new("qm8", "fill", "Students must ____ on time.", null, "arrive", "must + arrive.")
            ])
    ];

    public static LessonDef? Find(string slug) =>
        Lessons.FirstOrDefault(l => l.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase));
}
