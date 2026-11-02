/* ==========================================================
   JAGA LISAN — script.js
   Berjalan sepenuhnya offline (tanpa library eksternal).
   Isi: menu hamburger, pemutar audio dalil, pemeriksa informasi, kuis.
   ========================================================== */
(function () {
  "use strict";

  /* ---------- 1. Menu navigasi (hamburger di HP) ---------- */
  (function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var menu = document.getElementById("menu");
    if (!toggle || !menu) return;

    function setOpen(open) {
      menu.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
    }
    toggle.addEventListener("click", function () {
      setOpen(!menu.classList.contains("open"));
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
    document.addEventListener("click", function (e) {
      if (!menu.classList.contains("open")) return;
      if (!e.target.closest(".site-header")) setOpen(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1140) setOpen(false);
    });
  })();

  /* ---------- 2. Pemutar audio kartu dalil ----------
     Urutan: (1) file lokal assets/audio/<id>-arab|penjelasan.mp3/.wav
             (2) suara bawaan perangkat (text-to-speech) bila ada
             (3) pesan jelas file apa yang harus ditambahkan.        */
  (function initAudio() {
    var players = Array.prototype.slice.call(document.querySelectorAll(".audio-player"));
    if (!players.length) return;

    var synth = "speechSynthesis" in window ? window.speechSynthesis : null;
    if (synth) {
      synth.getVoices(); // memancing browser memuat daftar suara
      window.addEventListener("pagehide", function () { synth.cancel(); });
    }

    function tryAudio(src) {
      return new Promise(function (resolve, reject) {
        var a = new Audio();
        var done = false;
        function finish(ok) {
          if (done) return;
          done = true;
          a.removeEventListener("canplay", onOk);
          a.removeEventListener("error", onBad);
          clearTimeout(timer);
          ok ? resolve(a) : reject(new Error("tidak ada"));
        }
        function onOk() { finish(true); }
        function onBad() { finish(false); }
        a.addEventListener("canplay", onOk);
        a.addEventListener("error", onBad);
        var timer = setTimeout(function () { finish(false); }, 3500);
        a.preload = "auto";
        a.src = src;
        a.load();
      });
    }

    players.forEach(function (player) {
      var id = player.getAttribute("data-id");
      var card = player.closest(".dalil-card");
      var select = player.querySelector("select");
      var status = player.querySelector(".audio-status");
      var btnPlay = player.querySelector('[data-act="play"]');
      var btnPause = player.querySelector('[data-act="pause"]');
      var btnReplay = player.querySelector('[data-act="replay"]');

      var cache = {};      // mode -> HTMLAudioElement atau null
      var media = null;    // {type:'file', el} atau {type:'tts', u}
      var state = "idle";  // idle | playing | paused
      var token = 0;       // pembatal proses pemuatan yang sudah basi

      function setStatus(msg, warn) {
        status.textContent = msg || "";
        status.classList.toggle("warn", !!warn);
      }
      function setState(s) {
        state = s;
        player.classList.toggle("playing", s === "playing");
      }
      function mode() { return select.value; }
      function fileName(m) { return id + "-" + m + ".mp3"; }
      function noFileMsg(m) {
        return "File audio belum ada: letakkan " + fileName(m) + " di folder assets/audio/.";
      }
      function textFor(m) {
        if (m === "arab") return card.querySelector(".arabic").textContent.replace(/\s+/g, " ").trim();
        return Array.prototype.map.call(card.querySelectorAll("[data-tts]"), function (e) {
          return e.textContent.replace(/\s+/g, " ").trim();
        }).join(" ");
      }

      function loadFile(m) {
        if (cache[m] !== undefined) return Promise.resolve(cache[m]);
        var exts = ["mp3", "wav"];
        var i = 0;
        function next() {
          if (i >= exts.length) { cache[m] = null; return Promise.resolve(null); }
          var src = "assets/audio/" + id + "-" + m + "." + exts[i++];
          return tryAudio(src).then(function (el) { cache[m] = el; return el; }, next);
        }
        return next();
      }

      function findVoice(prefix) {
        if (!synth) return null;
        var voices = synth.getVoices() || [];
        for (var i = 0; i < voices.length; i++) {
          var l = (voices[i].lang || "").toLowerCase().replace("_", "-");
          if (l.indexOf(prefix) === 0) return voices[i];
        }
        return null;
      }

      function speakTTS(m) {
        if (!synth) {
          setState("idle");
          setStatus(noFileMsg(m) + " Browser ini juga tidak mendukung suara bawaan.", true);
          return;
        }
        var prefix = m === "arab" ? "ar" : "id";
        var voice = findVoice(prefix);
        var haveVoices = (synth.getVoices() || []).length > 0;
        if ((m === "arab" && !voice) || (m !== "arab" && haveVoices && !voice)) {
          setState("idle");
          setStatus(noFileMsg(m) + " Perangkat ini juga tidak memiliki suara " +
            (m === "arab" ? "Arab" : "Indonesia") + " bawaan.", true);
          return;
        }
        synth.cancel();
        var u = new SpeechSynthesisUtterance(textFor(m));
        u.lang = voice && voice.lang ? voice.lang : (m === "arab" ? "ar-SA" : "id-ID");
        if (voice) u.voice = voice;
        u.rate = m === "arab" ? 0.8 : 0.95;
        u.onend = function () {
          if (media && media.u === u) { setState("idle"); setStatus("Selesai. Tekan Putar atau Ulangi untuk mendengarkan lagi."); }
        };
        u.onerror = function (ev) {
          if (ev && (ev.error === "canceled" || ev.error === "interrupted")) return;
          setState("idle");
          setStatus("Suara bawaan gagal diputar. " + noFileMsg(m), true);
        };
        media = { type: "tts", u: u };
        synth.speak(u);
        setState("playing");
        setStatus(m === "arab"
          ? "Memutar dengan suara Arab bawaan perangkat (bukan qari). Untuk bacaan qari, tambahkan " + fileName(m) + "."
          : "Memutar dengan suara bawaan perangkat. Untuk rekaman sendiri, tambahkan " + fileName(m) + ".");
      }

      function stop() {
        token++;
        if (media) {
          if (media.type === "file") { media.el.pause(); try { media.el.currentTime = 0; } catch (e) {} media.el.onended = null; }
          else if (synth) synth.cancel();
        }
        media = null;
        if (state !== "idle") setStatus("Dihentikan.");
        setState("idle");
      }
      player._stop = stop;

      function start() {
        players.forEach(function (p) { if (p !== player && p._stop) p._stop(); });
        var my = ++token;
        var m = mode();
        setStatus("Menyiapkan audio…");
        loadFile(m).then(function (el) {
          if (my !== token) return;
          if (el) {
            media = { type: "file", el: el };
            el.currentTime = 0;
            el.onended = function () { setState("idle"); setStatus("Selesai. Tekan Putar atau Ulangi untuk mendengarkan lagi."); };
            var p = el.play();
            var okMsg = m === "arab" ? "Memutar bacaan Arab…" : "Memutar penjelasan…";
            if (p && p.then) {
              p.then(function () { setState("playing"); setStatus(okMsg); },
                     function () { setState("idle"); setStatus("Browser menolak memutar audio. Coba tekan Putar sekali lagi.", true); });
            } else { setState("playing"); setStatus(okMsg); }
          } else {
            speakTTS(m);
          }
        });
      }

      btnPlay.addEventListener("click", function () {
        if (state === "playing") return;
        if (state === "paused" && media) {
          if (media.type === "file") media.el.play(); else if (synth) synth.resume();
          setState("playing");
          setStatus("Melanjutkan…");
          return;
        }
        start();
      });
      btnPause.addEventListener("click", function () {
        if (state !== "playing" || !media) { setStatus("Belum ada audio yang sedang diputar."); return; }
        if (media.type === "file") media.el.pause(); else if (synth) synth.pause();
        setState("paused");
        setStatus("Dijeda. Tekan Putar untuk melanjutkan.");
      });
      btnReplay.addEventListener("click", function () {
        stop();
        start();
      });
      select.addEventListener("change", function () {
        stop();
        setStatus("Pilihan diganti. Tekan Putar untuk mendengarkan.");
      });
    });
  })();

  /* ---------- 3. Pemeriksa sebelum membagikan informasi ---------- */
  (function initChecker() {
    var box = document.getElementById("checker");
    if (!box) return;
    var inputs = box.querySelectorAll('input[type="checkbox"]');
    var out = document.getElementById("checker-result");
    function update() {
      var n = 0;
      for (var i = 0; i < inputs.length; i++) if (inputs[i].checked) n++;
      var total = inputs.length;
      out.classList.remove("ok");
      if (n === 0) {
        out.textContent = "Centang setiap pertanyaan yang sudah kamu pastikan jawabannya “ya”.";
      } else if (n < total) {
        out.textContent = "Tahan dulu! Masih ada " + (total - n) + " hal yang belum terpenuhi. Periksa lagi sebelum membagikannya.";
      } else {
        out.classList.add("ok");
        out.textContent = "Semua terpenuhi. Informasi ini layak dibagikan. Niatkan untuk kebaikan dan tetap berhati-hati.";
      }
    }
    for (var i = 0; i < inputs.length; i++) inputs[i].addEventListener("change", update);
    update();
  })();

  /* ---------- 4. Kuis interaktif ---------- */
  (function initQuiz() {
    var root = document.getElementById("quiz");
    if (!root) return;

    var QUIZ = [
      {
        topic: "Pengertian ghibah",
        q: "Menurut hadis riwayat Muslim, yang dimaksud ghibah adalah …",
        o: [
          "Menuduh orang lain berbuat sesuatu yang tidak pernah ia lakukan",
          "Menyebut saudaranya dengan sesuatu yang ia benci, padahal hal itu memang ada padanya",
          "Menyampaikan nasihat kepada teman secara langsung dan sopan",
          "Menceritakan kebaikan teman di hadapan banyak orang"
        ],
        a: 1,
        e: "Rasulullah ﷺ menjelaskan ghibah sebagai “menyebut saudaramu dengan sesuatu yang ia benci” (HR. Muslim no. 2589). Isi pembicaraannya benar adanya, tetapi orangnya tidak suka bila hal itu disebutkan di belakangnya."
      },
      {
        topic: "Pengertian fitnah",
        q: "Rani menyebarkan kabar bahwa Dika menyontek saat ujian, padahal tidak ada bukti dan Dika tidak melakukannya. Perbuatan Rani termasuk …",
        o: [
          "Ghibah, karena Dika tidak berada di tempat",
          "Tabayyun, karena Rani memberi kabar kepada teman-temannya",
          "Fitnah, karena menyebarkan tuduhan yang tidak benar tentang Dika",
          "Nasihat, karena Rani peduli pada kejujuran di kelas"
        ],
        a: 2,
        e: "Fitnah adalah menyebarkan tuduhan atau informasi yang tidak benar tentang seseorang. Dalam hadis, hal ini disebut buhtan: jika yang dikatakan tidak ada pada orangnya, berarti ia telah memfitnahnya (HR. Muslim no. 2589)."
      },
      {
        topic: "Perbedaan ghibah dan fitnah",
        q: "Perbedaan paling mendasar antara ghibah dan fitnah terletak pada …",
        o: [
          "Kebenaran isi yang dibicarakan: ghibah benar adanya, sedangkan fitnah tidak benar",
          "Jumlah orang yang mendengar pembicaraan tersebut",
          "Tempat terjadinya: ghibah di sekolah, fitnah di media sosial",
          "Hukumnya: ghibah dibolehkan, sedangkan fitnah dilarang"
        ],
        a: 0,
        e: "Ghibah membicarakan keburukan yang benar-benar ada pada seseorang, sedangkan fitnah menuduhkan sesuatu yang tidak benar. Keduanya sama-sama dilarang; fitnah lebih berat karena ditambah dusta."
      },
      {
        topic: "Dalil Al-Qur’an",
        q: "Dalam QS. Al-Hujurat ayat 12, larangan ghibah digambarkan dengan perumpamaan …",
        o: [
          "Menghamburkan harta tanpa manfaat",
          "Membakar kayu yang sudah kering",
          "Mengotori air yang jernih",
          "Memakan daging saudara sendiri yang sudah meninggal"
        ],
        a: 3,
        e: "Allah menggambarkan orang yang menggunjing seperti orang yang memakan daging saudaranya yang telah mati, sesuatu yang tentu menjijikkan (QS. Al-Hujurat [49]: 12)."
      },
      {
        topic: "Pengertian tabayyun",
        q: "Tabayyun yang diperintahkan dalam QS. Al-Hujurat ayat 6 berarti …",
        o: [
          "Menyebarkan kabar secepat mungkin agar semua orang tahu",
          "Meneliti dan memeriksa kebenaran suatu berita sebelum menerima atau menyebarkannya",
          "Mengabaikan semua berita tanpa mau mendengarkan apa pun",
          "Menanyakan pendapat mayoritas lalu mengikutinya"
        ],
        a: 1,
        e: "Tabayyun adalah meneliti dan mengklarifikasi kebenaran berita sebelum mempercayai atau membagikannya, agar kita tidak mencelakakan orang lain karena ketidaktahuan lalu menyesal (QS. Al-Hujurat [49]: 6)."
      },
      {
        topic: "Contoh kasus di sekolah",
        q: "Di grup kelas beredar pesan: “Katanya uang kas diambil si Dika.” Pesan itu belum ada buktinya. Sikap yang paling tepat adalah …",
        o: [
          "Meneruskan pesan ke grup lain agar banyak yang waspada",
          "Membalas dengan dugaan dan komentar sendiri",
          "Tidak menyebarkannya, lalu mengecek kebenarannya kepada pihak yang berwenang seperti bendahara atau wali kelas",
          "Langsung menjauhi Dika agar tidak ikut terseret"
        ],
        a: 2,
        e: "Kabar yang belum terbukti tidak boleh disebarkan. Lakukan tabayyun: tanyakan kepada pihak yang tepat dan jangan berprasangka. Meneruskan kabar yang belum jelas dapat berubah menjadi fitnah (QS. Al-Hujurat: 6 dan 12)."
      },
      {
        topic: "Dampak ghibah dan fitnah",
        q: "Dampak yang paling dirasakan korban ghibah dan fitnah adalah …",
        o: [
          "Nama baiknya tercemar, ia merasa malu dan tertekan, serta hubungan pertemanannya merenggang",
          "Ia mendapat banyak teman baru karena menjadi terkenal",
          "Nilai akademiknya otomatis meningkat",
          "Hidupnya menjadi lebih tenang karena banyak diperhatikan"
        ],
        a: 0,
        e: "Korban dapat kehilangan nama baik, merasa malu dan tertekan, dijauhi, bahkan enggan bersekolah. Pelaku pun rugi: menanggung dosa dan kehilangan kepercayaan orang lain."
      },
      {
        topic: "Cara menghindari ghibah",
        q: "Saat teman-temanmu mulai membicarakan kekurangan seorang teman yang tidak hadir, langkah yang paling sesuai ajaran Islam adalah …",
        o: [
          "Ikut menimpali supaya tidak dianggap sombong",
          "Diam saja sambil mendengarkan sampai selesai",
          "Merekam obrolan itu lalu membagikannya",
          "Menegur dengan sopan, mengalihkan ke pembicaraan yang baik, atau meninggalkan pembicaraan itu"
        ],
        a: 3,
        e: "Rasulullah ﷺ mengajarkan: berkata baik atau diam (HR. Bukhari dan Muslim). Bila ada ghibah, tegurlah dengan sopan, alihkan topik, atau menjauh. Sekadar mendengarkan sambil membiarkan membuat kita ikut terlibat."
      },
      {
        topic: "Menyelesaikan penyebaran informasi yang salah",
        q: "Dina terlanjur membagikan kabar yang ternyata keliru tentang temannya. Langkah penyelesaian yang paling tepat adalah …",
        o: [
          "Menunggu sampai orang-orang lupa dengan sendirinya",
          "Menghapus kabar itu, meluruskan secukupnya kepada yang telanjur menerima, meminta maaf kepada temannya, dan bertobat",
          "Membuat kabar baru untuk menutupi kabar yang lama",
          "Menyalahkan orang yang pertama mengirim kabar itu"
        ],
        a: 1,
        e: "Jalan keluarnya: hentikan penyebaran, hapus unggahan, luruskan informasi secukupnya, minta maaf kepada orang yang dirugikan, dan bertobat kepada Allah. Allah Maha Penerima tobat (QS. Al-Hujurat: 12)."
      },
      {
        topic: "Menjaga lisan di media sosial",
        q: "Kamu menerima pesan berantai berisi tuduhan terhadap seseorang tanpa sumber yang jelas dan meminta “sebarkan ke 10 orang”. Tindakan terbaik adalah …",
        o: [
          "Membagikannya karena mungkin benar dan berbahaya jika diabaikan",
          "Membagikannya dengan tambahan tulisan “belum tentu benar”",
          "Tidak meneruskannya, memeriksa sumber dan kebenarannya, serta mengingatkan pengirim dengan sopan",
          "Memberi komentar kasar kepada orang yang dituduh"
        ],
        a: 2,
        e: "“Cukuplah seseorang dianggap berdusta bila ia menceritakan semua yang ia dengar” (HR. Muslim). Periksa sumber, jangan ikut menyebarkan, dan ingatkan pengirim dengan cara yang baik."
      }
    ];

    var TOTAL = QUIZ.length;
    var LETTERS = ["A", "B", "C", "D"];
    var answers = new Array(TOTAL);
    for (var z = 0; z < TOTAL; z++) answers[z] = null;
    var cur = 0;

    var $ = function (id) { return document.getElementById(id); };
    var elIntro = $("quiz-intro"), elPlay = $("quiz-play"), elResult = $("quiz-result");
    var elCount = $("q-count"), elAnswered = $("q-answered"), elBar = $("q-bar"), elProg = $("q-progress");
    var elDots = $("q-dots"), elWarn = $("q-warn"), elTopic = $("q-topic"), elText = $("q-text"), elOpts = $("q-options");
    var btnPrev = $("q-prev"), btnNext = $("q-next"), btnFinish = $("q-finish");

    function answeredCount() {
      var n = 0;
      for (var i = 0; i < TOTAL; i++) if (answers[i] !== null) n++;
      return n;
    }
    function missingList() {
      var m = [];
      for (var i = 0; i < TOTAL; i++) if (answers[i] === null) m.push(i);
      return m;
    }
    function toTop() {
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function hideWarn() { elWarn.hidden = true; elWarn.textContent = ""; }

    function renderDots(missing) {
      elDots.innerHTML = "";
      for (var i = 0; i < TOTAL; i++) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "dot";
        if (answers[i] !== null) b.classList.add("done");
        if (missing && answers[i] === null) b.classList.add("missing");
        if (i === cur) b.classList.add("current");
        b.textContent = String(i + 1);
        b.setAttribute("aria-label", "Soal " + (i + 1) + (answers[i] !== null ? " (sudah dijawab)" : " (belum dijawab)"));
        (function (idx) { b.addEventListener("click", function () { goTo(idx); }); })(i);
        elDots.appendChild(b);
      }
    }

    function render(missing) {
      var item = QUIZ[cur];
      elCount.textContent = "Soal " + (cur + 1) + " dari " + TOTAL;
      var n = answeredCount();
      elAnswered.textContent = n + " dari " + TOTAL + " soal sudah dijawab";
      elBar.style.width = (n / TOTAL * 100) + "%";
      elProg.setAttribute("aria-valuenow", String(n));
      elTopic.textContent = item.topic;
      elText.textContent = item.q;
      elOpts.innerHTML = "";
      for (var i = 0; i < item.o.length; i++) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "opt" + (answers[cur] === i ? " selected" : "");
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", answers[cur] === i ? "true" : "false");
        var k = document.createElement("span");
        k.className = "key";
        k.textContent = LETTERS[i];
        var t = document.createElement("span");
        t.textContent = item.o[i];
        b.appendChild(k);
        b.appendChild(t);
        (function (idx) { b.addEventListener("click", function () { choose(idx); }); })(i);
        elOpts.appendChild(b);
      }
      btnPrev.disabled = cur === 0;
      btnNext.textContent = cur === TOTAL - 1 ? "Selesai dan Lihat Hasil" : "Soal Berikutnya";
      btnFinish.hidden = !(n === TOTAL && cur !== TOTAL - 1);
      renderDots(missing);
    }

    function choose(i) {
      answers[cur] = i;
      hideWarn();
      render(false);
    }
    function goTo(i) {
      cur = Math.max(0, Math.min(TOTAL - 1, i));
      hideWarn();
      render(false);
    }

    function finish() {
      var miss = missingList();
      if (miss.length) {
        var nums = miss.map(function (x) { return x + 1; });
        var txt = nums.length > 1 ? nums.slice(0, -1).join(", ") + " dan " + nums[nums.length - 1] : String(nums[0]);
        cur = miss[0];
        render(true);
        elWarn.textContent = "Masih ada " + miss.length + " soal yang belum dijawab (nomor " + txt + "). Jawab semua soal terlebih dahulu agar nilai akhir dapat ditampilkan.";
        elWarn.hidden = false;
        toTop();
        return;
      }
      showResult();
    }

    function showResult() {
      var correct = 0;
      for (var i = 0; i < TOTAL; i++) if (answers[i] === QUIZ[i].a) correct++;
      var wrong = TOTAL - correct;
      var score = Math.round((correct / TOTAL) * 100); // nilai = (benar / 10) x 100

      $("r-score").textContent = String(score);
      $("r-ring").style.setProperty("--p", String(score));
      $("r-correct").textContent = String(correct);
      $("r-wrong").textContent = String(wrong);
      $("r-total").textContent = String(TOTAL);

      var title, msg;
      if (score === 100) { title = "Masya Allah, sempurna!"; msg = "Seluruh jawabanmu benar. Pertahankan, dan jadikan kebiasaan menjaga lisan dalam keseharian."; }
      else if (score >= 80) { title = "Sangat baik!"; msg = "Pemahamanmu sudah kuat. Baca pembahasan pada soal yang keliru agar semakin mantap."; }
      else if (score >= 60) { title = "Cukup baik."; msg = "Kamu sudah memahami sebagian besar materi. Ulangi bagian yang masih keliru di halaman Materi dan Dalil."; }
      else { title = "Ayo belajar lagi."; msg = "Jangan berkecil hati. Pelajari kembali halaman Materi dan Dalil, lalu coba kuis ini sekali lagi."; }
      $("r-title").textContent = title;
      $("r-msg").textContent = msg;

      var list = $("r-review");
      list.innerHTML = "";
      QUIZ.forEach(function (item, idx) {
        var ok = answers[idx] === item.a;
        var box = document.createElement("article");
        box.className = "review-item " + (ok ? "correct" : "wrong");

        var rq = document.createElement("div");
        rq.className = "rq";
        var n = document.createElement("span");
        n.className = "n";
        n.textContent = String(idx + 1);
        var qt = document.createElement("span");
        qt.textContent = item.q;
        var badge = document.createElement("span");
        badge.className = ok ? "badge-ok" : "badge-bad";
        badge.textContent = ok ? "✓ Benar" : "✗ Salah";
        qt.appendChild(badge);
        rq.appendChild(n);
        rq.appendChild(qt);
        box.appendChild(rq);

        var chosen = document.createElement("div");
        chosen.className = "ans-row " + (ok ? "user-ok" : "user-bad");
        var l1 = document.createElement("span");
        l1.className = "lab";
        l1.textContent = ok ? "✓ Jawabanmu" : "✗ Jawabanmu";
        var v1 = document.createElement("span");
        v1.textContent = LETTERS[answers[idx]] + ". " + item.o[answers[idx]];
        chosen.appendChild(l1);
        chosen.appendChild(v1);
        box.appendChild(chosen);

        if (!ok) {
          var key = document.createElement("div");
          key.className = "ans-row key";
          var l2 = document.createElement("span");
          l2.className = "lab";
          l2.textContent = "✓ Kunci jawaban";
          var v2 = document.createElement("span");
          v2.textContent = LETTERS[item.a] + ". " + item.o[item.a];
          key.appendChild(l2);
          key.appendChild(v2);
          box.appendChild(key);
        }

        var ex = document.createElement("p");
        ex.className = "explain";
        var strong = document.createElement("strong");
        strong.textContent = "Pembahasan: ";
        ex.appendChild(strong);
        ex.appendChild(document.createTextNode(item.e));
        box.appendChild(ex);

        list.appendChild(box);
      });

      elPlay.hidden = true;
      elIntro.hidden = true;
      elResult.hidden = false;
      toTop();
    }

    function start() {
      for (var i = 0; i < TOTAL; i++) answers[i] = null;
      cur = 0;
      hideWarn();
      elIntro.hidden = true;
      elResult.hidden = true;
      elPlay.hidden = false;
      render(false);
      toTop();
    }

    $("quiz-start").addEventListener("click", start);
    $("quiz-retry").addEventListener("click", start);
    btnPrev.addEventListener("click", function () { goTo(cur - 1); });
    btnNext.addEventListener("click", function () {
      if (cur === TOTAL - 1) finish(); else goTo(cur + 1);
    });
    btnFinish.addEventListener("click", finish);
  })();
})();
