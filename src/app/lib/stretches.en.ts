/**
 * ストレッチ内容の英語版
 *
 * 日本語データ(stretches.ts)は一切変更せず、ここに id で対応する英文を置く。
 * getStretchesBySymptom(symptomId, locale) が locale に応じて差し替える。
 *
 * 【英語版で守るルール】
 * - 症状名や病名を「治る/改善する」と断定しない(FTC の健康表示規制)
 *   例: 「ストレートネックの改善」→ 何の筋肉がどう動くかを事実として書く
 * - "cure" "treat" "fix" "heal" "relieve pain" は使わない
 * - 効果は体の動きの説明として書く(loosen / lengthen / range of motion)
 */

export interface StretchText {
  title: string;
  duration: string;
  reps: string;
  steps: string[];
  tips: string;
  benefit: string;
}

export const STRETCHES_EN: Record<string, StretchText> = {
  // ========== Neck ==========
  "neck-1": {
    title: "Side Neck Stretch",
    duration: "20 sec each side",
    reps: "3 sets",
    steps: [
      "Sit back in a chair with your spine tall. Feet hip-width apart, soles flat on the floor.",
      "Rest your right hand gently on the left side of your head. Let the weight of your hand do the work — don't pull.",
      "Breathe out slowly and let your head tip to the right. Feel your left ear move away from your left shoulder.",
      "Stop where you feel a gentle stretch down the left side of your neck. Hold 20 seconds, breathing normally.",
      "Bring your head back to center and take one deep breath. Repeat on the other side (left hand, right side of head) for 20 seconds.",
      "One round each side is a set. Do 3 sets.",
    ],
    tips: "Keep the opposite shoulder pressed down toward the floor so it doesn't ride up with your head.",
    benefit: "Lengthens the muscles along the side of your neck, including the sternocleidomastoid.",
  },
  "neck-2": {
    title: "Neck Circles",
    duration: "30 sec each direction",
    reps: "2 sets",
    steps: [
      "Sit back in a chair, spine tall, shoulders relaxed. Rest your hands on your thighs.",
      "Breathe out and lower your chin toward your chest. Feel the back of your neck lengthen.",
      "From there, roll your head slowly clockwise: right ear toward right shoulder, back, left shoulder, front. Draw one or two large circles over 30 seconds.",
      "Return to center and rest for 5 seconds.",
      "Now roll counter-clockwise (left ear, left shoulder, back, right shoulder, front) for 30 seconds.",
      "One round each direction is a set. Do 2 sets.",
    ],
    tips: "Speed doesn't matter — the feeling of an easy stretch does. Stop before anything hurts.",
    benefit: "Takes your neck through its full range of motion so no one area stays locked up.",
  },
  "neck-3": {
    title: "Chin Tuck",
    duration: "Hold 10 sec",
    reps: "10 reps",
    steps: [
      "Stand with your back against a wall — head, upper back, hips and heels all touching. This is your starting position.",
      "Tuck your chin slightly and press the back of your head into the wall. Think of making a double chin.",
      "Notice the back of your neck lengthening and the top of your head lifting.",
      "Hold for 10 seconds. Keep breathing — don't hold your breath.",
      "Release slowly and let your head return to neutral.",
      "Repeat 10 times.",
    ],
    tips: "Draw your chin straight back, not down. Looking at the floor is a different movement.",
    benefit: "Works the deep flexors at the front of the neck — the muscles that hold your head over your shoulders rather than out in front.",
  },
  "neck-4": {
    title: "Upper Neck Stretch (Levator Scapulae)",
    duration: "20 sec each side",
    reps: "3 sets",
    steps: [
      "Sit back in a chair with your spine tall and shoulders relaxed. Feet flat on the floor.",
      "Turn your head 45 degrees to the right, as if looking at something to your right. This is a rotation, not a tilt — that's the key.",
      "From there, lower your chin toward your right chest. Let your gaze travel down toward your right toes.",
      "Rest your left hand on the back of your head, just above the right ear. Let the weight of your hand press gently — don't pull.",
      "Feel a deep stretch from the left side of the back of your neck down to where it meets your shoulder. Hold 20 seconds.",
      "Return slowly and repeat on the other side (turn 45 degrees left, chin toward left chest) for 20 seconds. One round each side is a set. Do 3 sets.",
    ],
    tips: "Rotate first, then lower. That order is what makes this different from the side tilt — it reaches the deeper muscle underneath.",
    benefit: "Targets the levator scapulae, a deep muscle that runs from your neck to your shoulder blade and is often the one that stays tight.",
  },
  "neck-5": {
    title: "Shoulder Blade Squeeze",
    duration: "Hold 5 sec",
    reps: "15 reps",
    steps: [
      "Sit toward the front of a chair with your spine tall. Let your arms hang naturally.",
      "Bend both elbows to 90 degrees with your palms facing forward.",
      "Draw your elbows back and squeeze your shoulder blades toward your spine.",
      "Open your chest and hold for 5 seconds. Imagine holding something between your shoulder blades.",
      "Release slowly and return your arms to the start.",
      "Repeat 15 times.",
    ],
    tips: "Keep your shoulders down. Move the shoulder blades, not the shoulders.",
    benefit: "Loosens the area around the shoulder blades and takes load off the neck and shoulders.",
  },

  // ========== Shoulder ==========
  "shoulder-1": {
    title: "Shoulder Rolls",
    duration: "30 sec each direction",
    reps: "2 sets",
    steps: [
      "Stand with feet hip-width apart (or sit in a chair) and let your arms hang loose.",
      "Shrug your shoulders up toward your ears, then roll them forward in a big circle.",
      "Go shoulders forward, down, back, up — 5 or 6 full rotations over 30 seconds.",
      "Reverse the direction (back, down, forward, up) for another 30 seconds and 5 or 6 rotations.",
      "Think about your shoulder blades, so your whole upper back moves, not just your shoulders.",
      "Do 2 sets.",
    ],
    tips: "Keep your elbows and hands loose. Make the shoulder blades travel as far as they comfortably can.",
    benefit: "Gets blood moving around the shoulder joint and takes desk-work stiffness out of the area.",
  },
  "shoulder-2": {
    title: "Cross-Body Arm Stretch",
    duration: "20 sec each side",
    reps: "3 sets",
    steps: [
      "Stand with feet hip-width apart, or sit tall in a chair.",
      "Reach your right arm straight across your chest at shoulder height, fingers pointing left.",
      "Use your left hand to hold the outside of your right elbow and draw it toward your body.",
      "Feel the stretch across the back of your right shoulder. Hold 20 seconds.",
      "Release slowly and repeat on the other side (left arm, right hand) for 20 seconds.",
      "One round each side is a set. Do 3 sets.",
    ],
    tips: "Pull only to the point where it feels good, never painful. Think about the outer edge of the shoulder blade.",
    benefit: "Lengthens the back of the shoulder (rear deltoid and the outside of the shoulder blade), so the arm moves more freely.",
  },
  "shoulder-3": {
    title: "Towel Shoulder Stretch",
    duration: "Hold 15 sec",
    reps: "10 reps",
    steps: [
      "Take a long hand towel or bath towel and hold each end, hands wider than shoulder-width.",
      "Stand tall and raise both arms straight overhead, keeping the towel taut.",
      "Without bending your elbows, lower the towel slowly behind you.",
      "If your shoulders are tight, stop early — don't force it. Hold 15 seconds where your shoulder blades come together.",
      "Return slowly to overhead.",
      "Repeat 10 times.",
    ],
    tips: "If you can't get far behind you, hold the towel wider. That makes the whole movement easier.",
    benefit: "Takes your shoulder through a wide range of motion in a controlled way.",
  },
  "shoulder-4": {
    title: "Shrug and Release",
    duration: "Hold 5 sec",
    reps: "20 reps",
    steps: [
      "Sit back in a chair or stand, arms hanging loose.",
      "Breathe in and shrug both shoulders up toward your ears as high as they go.",
      "Hold that squeeze for 5 seconds. Feel the muscles genuinely contract.",
      "Breathe out and drop your shoulders all at once — let them fall.",
      "Notice the warmth and the release in that moment.",
      "Repeat 20 times.",
    ],
    tips: "The contrast between the squeeze and the drop is the whole point. Pay attention to the letting-go.",
    benefit: "Contract-then-release resets muscles around the shoulders that have been holding tension all day.",
  },
  "shoulder-5": {
    title: "Wall Chest Opener",
    duration: "Hold 30 sec",
    reps: "3 sets each side",
    steps: [
      "Stand beside a wall so your right shoulder faces it.",
      "Place your right hand flat on the wall at shoulder height. A slight bend in the elbow is fine.",
      "Slowly rotate your body to the left, keeping your hand on the wall.",
      "Stop where you feel a good stretch across the front of your chest. Hold 30 seconds.",
      "Rotate back slowly and repeat on the other side for 30 seconds.",
      "One round each side is a set. Do 3 sets.",
    ],
    tips: "Especially useful if your shoulders sit forward. Changing the height of your hand changes where you feel it.",
    benefit: "Lengthens the chest muscles that pull your shoulders forward when you sit at a desk.",
  },

  // ========== Lower back ==========
  "back-1": {
    title: "Knees to Chest",
    duration: "Hold 30 sec",
    reps: "3 sets",
    steps: [
      "Lie on your back on a mat, arms and legs extended naturally.",
      "Slowly draw both knees toward your chest.",
      "Wrap your arms around your knees (or your shins) and hug them in.",
      "Your lower back will lift slightly off the floor. Hold 30 seconds and feel it lengthen.",
      "Extend your legs slowly back to the start and take three deep breaths.",
      "Repeat for 3 sets.",
    ],
    tips: "Keep your head on the floor so your neck stays relaxed. Keep breathing — don't hold your breath.",
    benefit: "Lengthens the muscles across the lower back, including the quadratus lumborum and the erector spinae.",
  },
  "back-2": {
    title: "Child's Pose",
    duration: "Hold 60 sec",
    reps: "2 sets",
    steps: [
      "Start kneeling, then open your knees slightly wider than your hips.",
      "Sit your hips back onto your heels.",
      "Breathe out and fold forward, bringing your forehead to the floor or mat.",
      "Extend both arms forward with your palms down.",
      "Breathe deeply for 60 seconds, feeling the length through your lower back, upper back and shoulders.",
      "Come back up to kneeling slowly and take three deep breaths. Repeat for 2 sets.",
    ],
    tips: "If your knees or hips complain, put a cushion under your knees. The deeper you breathe, the more your whole back opens on its own.",
    benefit: "Lengthens the lower back and the area around the sacroiliac joints. Slow breathing here also engages the parasympathetic nervous system, which is why it feels calming.",
  },
  "back-3": {
    title: "Cat & Cow",
    duration: "10 reps",
    reps: "3 sets",
    steps: [
      "Come onto hands and knees. Hands directly under your shoulders, knees under your hips.",
      "Breathe in and let your belly drop toward the floor, arching your back (Cow). Look up, tailbone lifts.",
      "Hold 2 seconds, then breathe out and slowly round your back (Cat).",
      "Draw your navel up toward your spine, look down, and round as far as you comfortably can.",
      "Arch and round together count as one rep. Do 10.",
      "Do 3 sets.",
    ],
    tips: "Sync the movement with your breath — that's what makes this work. Move slowly and use your full range.",
    benefit: "Moves your spine one segment at a time, which is what keeps it mobile.",
  },
  "back-4": {
    title: "Hip Bridge",
    duration: "Hold 5 sec",
    reps: "15 reps x 3 sets",
    steps: [
      "Lie on your back and bend your knees. Feet hip-width apart, flat on the floor.",
      "Rest your arms beside your body, palms down.",
      "Squeeze your glutes and lift your hips slowly toward the ceiling.",
      "Stop when your shoulders, hips and knees form a straight line. Squeeze harder and hold 5 seconds.",
      "Lower slowly and stop just before your hips touch the floor, then go again.",
      "15 reps is a set. Rest 30 seconds between sets and do 3.",
    ],
    tips: "Don't over-arch your lower back. Use your glutes and your abdominals together.",
    benefit: "Builds strength through the glutes, lower back and core — the muscles that hold your posture up all day.",
  },
  "back-5": {
    title: "Hamstring Stretch",
    duration: "30 sec each side",
    reps: "2 sets",
    steps: [
      "Lie on your back with both knees bent. A towel nearby makes this easier.",
      "Raise your right leg slowly toward the ceiling. A slight bend in the knee is fine.",
      "Hold the back of your right thigh (or your calf) with both hands and draw it toward you. You can also loop a towel around your foot.",
      "Feel the stretch down the back of your thigh. Hold 30 seconds.",
      "Lower slowly and repeat with the left leg for 30 seconds.",
      "One round each side is a set. Do 2 sets.",
    ],
    tips: "Don't force the knee straight. Wherever the back of the thigh feels a good stretch is far enough.",
    benefit: "Lengthens the hamstrings, which pull on the pelvis and change how your lower back sits when they're tight.",
  },
};
