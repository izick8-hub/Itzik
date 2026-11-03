# Lift Journal personalized icon family

56 generated mascot illustrations based on user-supplied portraits. Transparent PNG sprite sheets, not SVG vectors or individual cutouts.

Muscle atlas: 3 columns × 2 rows, 512px square cells. Order: Shoulders, Legs, Back / Triceps, Biceps, Chest.

Action atlas: 5 columns × 10 rows. See manifest.json for the 50 semantic names and zero-based cell positions. The sheet is 887×1774; fractional grid positions should be calculated proportionally.

Display each tile in a square overflow-hidden viewport. Scale the muscle sheet to 300% width and 200% height; position left = -column × 100%, top = -row × 100%. Keep PNG transparency, preserve aspect ratio, and use restrained dark containers. The app uses 64px muscle illustrations and 36px day-card illustrations.

The 50 action variants are included for future use; functional app buttons intentionally retain simple SVG icons for small-screen clarity.
