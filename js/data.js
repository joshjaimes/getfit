// Built-in exercise library, split templates and common foods.
export const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs', 'Forearms', 'Cardio'];
export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell', 'Band', 'Other'];

const E = `Bench Press|Chest|Barbell
Incline Bench Press|Chest|Barbell
Decline Bench Press|Chest|Barbell
Dumbbell Bench Press|Chest|Dumbbell
Incline Dumbbell Press|Chest|Dumbbell
Dumbbell Fly|Chest|Dumbbell
Cable Crossover|Chest|Cable
Chest Press Machine|Chest|Machine
Pec Deck|Chest|Machine
Push Up|Chest|Bodyweight
Chest Dip|Chest|Bodyweight
Deadlift|Back|Barbell
Barbell Row|Back|Barbell
T-Bar Row|Back|Barbell
Dumbbell Row|Back|Dumbbell
Pull Up|Back|Bodyweight
Chin Up|Back|Bodyweight
Lat Pulldown|Back|Cable
Seated Cable Row|Back|Cable
Straight Arm Pulldown|Back|Cable
Machine Row|Back|Machine
Back Extension|Back|Bodyweight
Shrug|Back|Dumbbell
Overhead Press|Shoulders|Barbell
Dumbbell Shoulder Press|Shoulders|Dumbbell
Arnold Press|Shoulders|Dumbbell
Shoulder Press Machine|Shoulders|Machine
Lateral Raise|Shoulders|Dumbbell
Cable Lateral Raise|Shoulders|Cable
Front Raise|Shoulders|Dumbbell
Rear Delt Fly|Shoulders|Dumbbell
Reverse Pec Deck|Shoulders|Machine
Face Pull|Shoulders|Cable
Upright Row|Shoulders|Barbell
Barbell Curl|Biceps|Barbell
EZ Bar Curl|Biceps|Barbell
Dumbbell Curl|Biceps|Dumbbell
Hammer Curl|Biceps|Dumbbell
Incline Dumbbell Curl|Biceps|Dumbbell
Preacher Curl|Biceps|Machine
Cable Curl|Biceps|Cable
Concentration Curl|Biceps|Dumbbell
Close Grip Bench Press|Triceps|Barbell
Skull Crusher|Triceps|Barbell
Triceps Pushdown|Triceps|Cable
Rope Pushdown|Triceps|Cable
Overhead Triceps Extension|Triceps|Cable
Dumbbell Triceps Extension|Triceps|Dumbbell
Triceps Dip|Triceps|Bodyweight
Triceps Kickback|Triceps|Dumbbell
Squat|Quads|Barbell
Front Squat|Quads|Barbell
Hack Squat|Quads|Machine
Leg Press|Quads|Machine
Leg Extension|Quads|Machine
Bulgarian Split Squat|Quads|Dumbbell
Goblet Squat|Quads|Dumbbell
Walking Lunge|Quads|Dumbbell
Step Up|Quads|Dumbbell
Romanian Deadlift|Hamstrings|Barbell
Dumbbell Romanian Deadlift|Hamstrings|Dumbbell
Lying Leg Curl|Hamstrings|Machine
Seated Leg Curl|Hamstrings|Machine
Good Morning|Hamstrings|Barbell
Nordic Curl|Hamstrings|Bodyweight
Hip Thrust|Glutes|Barbell
Glute Bridge|Glutes|Bodyweight
Cable Kickback|Glutes|Cable
Hip Abduction Machine|Glutes|Machine
Sumo Deadlift|Glutes|Barbell
Standing Calf Raise|Calves|Machine
Seated Calf Raise|Calves|Machine
Leg Press Calf Raise|Calves|Machine
Plank|Abs|Bodyweight
Crunch|Abs|Bodyweight
Cable Crunch|Abs|Cable
Hanging Leg Raise|Abs|Bodyweight
Lying Leg Raise|Abs|Bodyweight
Ab Wheel Rollout|Abs|Other
Russian Twist|Abs|Bodyweight
Sit Up|Abs|Bodyweight
Wrist Curl|Forearms|Dumbbell
Reverse Curl|Forearms|Barbell
Farmer Carry|Forearms|Dumbbell
Kettlebell Swing|Glutes|Kettlebell
Treadmill|Cardio|Machine
Stationary Bike|Cardio|Machine
Rowing Machine|Cardio|Machine
Stair Climber|Cardio|Machine
Elliptical|Cardio|Machine
Jump Rope|Cardio|Other`;
export const EXERCISES = E.split('\n').map(l => { const [name, muscle, equipment] = l.split('|'); return { id: slug(name), name, muscle, equipment }; });

// name: [exercise, sets, reps]
const R = {
  Push: [['Bench Press', 4, '6-8'], ['Incline Dumbbell Press', 3, '8-10'], ['Overhead Press', 3, '8-10'], ['Lateral Raise', 4, '12-15'], ['Triceps Pushdown', 3, '10-12'], ['Overhead Triceps Extension', 3, '10-12']],
  Pull: [['Deadlift', 3, '5'], ['Pull Up', 3, '6-10'], ['Barbell Row', 3, '8-10'], ['Lat Pulldown', 3, '10-12'], ['Face Pull', 3, '12-15'], ['Barbell Curl', 3, '8-10'], ['Hammer Curl', 3, '10-12']],
  Legs: [['Squat', 4, '6-8'], ['Romanian Deadlift', 3, '8-10'], ['Leg Press', 3, '10-12'], ['Lying Leg Curl', 3, '10-12'], ['Leg Extension', 3, '12-15'], ['Standing Calf Raise', 4, '10-15']],
  Upper: [['Bench Press', 4, '6-8'], ['Barbell Row', 4, '6-8'], ['Dumbbell Shoulder Press', 3, '8-10'], ['Lat Pulldown', 3, '10-12'], ['Lateral Raise', 3, '12-15'], ['Dumbbell Curl', 3, '10-12'], ['Triceps Pushdown', 3, '10-12']],
  Lower: [['Squat', 4, '6-8'], ['Romanian Deadlift', 3, '8-10'], ['Leg Press', 3, '10-12'], ['Seated Leg Curl', 3, '10-12'], ['Standing Calf Raise', 4, '10-15'], ['Hanging Leg Raise', 3, '10-15']],
  'Full Body A': [['Squat', 3, '5-8'], ['Bench Press', 3, '5-8'], ['Barbell Row', 3, '6-10'], ['Lateral Raise', 3, '12-15'], ['Dumbbell Curl', 2, '10-12'], ['Plank', 3, '30-60s']],
  'Full Body B': [['Deadlift', 3, '5'], ['Overhead Press', 3, '5-8'], ['Lat Pulldown', 3, '8-12'], ['Leg Press', 3, '10-12'], ['Triceps Pushdown', 2, '10-12'], ['Cable Crunch', 3, '12-15']],
  Chest: [['Bench Press', 4, '6-8'], ['Incline Dumbbell Press', 4, '8-10'], ['Cable Crossover', 3, '12-15'], ['Chest Dip', 3, '8-12'], ['Pec Deck', 3, '12-15']],
  Back: [['Deadlift', 3, '5'], ['Pull Up', 4, '6-10'], ['Barbell Row', 4, '8-10'], ['Seated Cable Row', 3, '10-12'], ['Straight Arm Pulldown', 3, '12-15']],
  Shoulders: [['Overhead Press', 4, '6-8'], ['Arnold Press', 3, '8-10'], ['Lateral Raise', 4, '12-15'], ['Rear Delt Fly', 3, '12-15'], ['Shrug', 3, '10-12']],
  Arms: [['Barbell Curl', 4, '8-10'], ['Skull Crusher', 4, '8-10'], ['Hammer Curl', 3, '10-12'], ['Rope Pushdown', 3, '10-12'], ['Preacher Curl', 3, '10-12'], ['Triceps Dip', 3, '8-12']],
};
const mk = name => ({ name, exercises: R[name].map(([n, sets, reps]) => ({ exerciseId: slug(n), sets, reps, rest: /^(5|5-8|6-8)$/.test(reps) ? 150 : 90 })) });
// schedule = routine index for Monday..Sunday (null = rest day)
export const SPLITS = [
  { name: 'Push / Pull / Legs', desc: '6 days a week. Each muscle twice a week.', routines: ['Push', 'Pull', 'Legs'].map(mk), schedule: [0, 1, 2, 0, 1, 2, null] },
  { name: 'Push / Pull / Legs (3 day)', desc: '3 days a week. Mon, Wed, Fri.', routines: ['Push', 'Pull', 'Legs'].map(mk), schedule: [0, null, 1, null, 2, null, null] },
  { name: 'Upper / Lower', desc: '4 days a week. Good balance of work and recovery.', routines: ['Upper', 'Lower'].map(mk), schedule: [0, 1, null, 0, 1, null, null] },
  { name: 'Full Body', desc: '3 days a week. Great for beginners or busy weeks.', routines: ['Full Body A', 'Full Body B'].map(mk), schedule: [0, null, 1, null, 0, null, null] },
  { name: 'Body Part Split', desc: '5 days a week. One muscle group per day.', routines: ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms'].map(mk), schedule: [0, 1, 2, 3, 4, null, null] },
];

// name | serving | grams | kcal | protein | carbs | fat
const F = `Chicken breast, cooked|4 oz|113|187|35|0|4
Chicken thigh, cooked|4 oz|113|232|28|0|13
Ground beef 90% lean, cooked|4 oz|113|231|29|0|12
Ground beef 80% lean, cooked|4 oz|113|307|29|0|20
Ground turkey 93% lean, cooked|4 oz|113|213|27|0|11
Steak, sirloin, cooked|4 oz|113|230|30|0|11
Salmon, cooked|4 oz|113|233|25|0|14
Tuna, canned in water|1 can|142|120|27|0|1
Shrimp, cooked|4 oz|113|112|27|0|0.3
Bacon|2 slices|16|86|6|0|7
Egg, large|1 egg|50|72|6|0.4|5
Egg whites|3 tbsp|46|25|5|0|0
Whey protein powder|1 scoop|31|120|24|3|1.5
Greek yogurt, nonfat plain|1 container|170|100|17|6|0.7
Cottage cheese, 2%|1/2 cup|113|92|12|5|2.6
Milk, 2%|1 cup|244|122|8|12|4.8
Milk, whole|1 cup|244|149|8|12|8
Cheddar cheese|1 slice|28|113|7|0.4|9
String cheese|1 stick|28|80|7|1|6
Butter|1 tbsp|14|102|0.1|0|11.5
Olive oil|1 tbsp|14|119|0|0|13.5
White rice, cooked|1 cup|158|205|4.3|45|0.4
Brown rice, cooked|1 cup|195|216|5|45|1.8
Pasta, cooked|1 cup|140|220|8|43|1.3
Oatmeal, dry|1/2 cup|40|150|5|27|3
Bread, white|1 slice|28|75|2.5|14|1
Bread, whole wheat|1 slice|32|81|4|14|1.1
Bagel, plain|1 bagel|105|277|11|55|1.4
Tortilla, flour|1 medium|45|140|4|24|3.5
Potato, baked|1 medium|173|161|4.3|37|0.2
Sweet potato, baked|1 medium|114|103|2.3|24|0.2
Quinoa, cooked|1 cup|185|222|8|39|3.6
Black beans, canned|1/2 cup|130|114|7.6|20|0.5
Banana|1 medium|118|105|1.3|27|0.4
Apple|1 medium|182|95|0.5|25|0.3
Orange|1 medium|131|62|1.2|15|0.2
Strawberries|1 cup|152|49|1|12|0.5
Blueberries|1 cup|148|84|1.1|21|0.5
Grapes|1 cup|151|104|1.1|27|0.2
Avocado|1/2 fruit|100|160|2|8.5|14.7
Broccoli, cooked|1 cup|156|55|3.7|11|0.6
Spinach, raw|2 cups|60|14|1.7|2.2|0.2
Carrots, raw|1 medium|61|25|0.6|6|0.1
Green beans, cooked|1 cup|125|44|2.4|10|0.4
Mixed salad greens|2 cups|85|15|1.3|3|0.2
Peanut butter|2 tbsp|32|188|8|6|16
Almonds|1 oz|28|164|6|6|14
Walnuts|1 oz|28|185|4.3|3.9|18.5
Protein bar|1 bar|60|210|20|22|8
Granola bar|1 bar|42|190|4|29|7
Honey|1 tbsp|21|64|0.1|17|0
Orange juice|1 cup|248|112|1.7|26|0.5
Soda, cola|1 can|368|150|0|39|0
Beer, regular|12 fl oz|356|153|1.6|13|0
Coffee, black|1 cup|237|2|0.3|0|0
Pizza, cheese|1 slice|107|285|12|36|10
Cheeseburger, fast food|1 burger|119|303|15|30|14
French fries|1 medium|117|365|4|48|17
Burrito, chicken|1 burrito|300|520|32|58|17
Ice cream, vanilla|1/2 cup|66|137|2.3|16|7`;
export const COMMON_FOODS = F.split('\n').map(l => {
  const [name, serving, grams, kcal, p, c, f] = l.split('|');
  return { id: 'c-' + slug(name), name, serving, grams: +grams, kcal: +kcal, p: +p, c: +c, f: +f };
});

export const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
export const MEASURES = ['Waist', 'Chest', 'Arms', 'Thighs', 'Hips', 'Neck', 'Shoulders'];
