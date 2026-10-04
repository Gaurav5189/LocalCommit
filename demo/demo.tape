Output demo/demo.gif

Require git
Require node

Set FontSize 16
Set Width 1200
Set Height 600
Set Theme "Dracula"

Type "echo 'feat(demo): add sample file' > sample.txt"
Sleep 500ms
Enter
Sleep 500ms
Type "git add sample.txt"
Sleep 500ms
Enter
Sleep 500ms
Type "npx ts-node src/index.ts"
Sleep 200ms
Enter
Sleep 3000ms

# Note: In real recording, user presses 'y' at prompt
