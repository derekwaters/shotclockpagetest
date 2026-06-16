# Shot Clock Trainer

## Synopsis

The page is intended to help simulate running the shot clock in a game of basketball. It will show a sample basketball game with a set of controls to simulate running the shot clock.

## Page Layout

The top two thirds of the page should show an embedded YouTube video from this URL:

https://youtu.be/_UuXmPtR94c

The bottom third of the page should consist of three panels. From left to right, these will show:

* The game clock which will show both the current quarter and the remaining time in the quarter
* The shot clock which will be controlled by the user, as well as the user's accuracy at running the shot clock. This panel should also show any notes about the current situation that are included in the timings definition file.
* A control panel for shot clock controls

The shot clock controls panel should have three buttons:

* Start/Stop Shot Clock Toggle Button - this should also be triggered when the user presses the space bar
* Full Shot Clock Reset - this should reset the shot clock to 24 seconds, and also be triggered when the user presses the r key
* Alternate Shot Clock Reset - this should reset the shot clock to 14 seconds, and also be triggered when the user presses the t key

This panel should also include a "help mode" toggle button. If this is turned on, then the shot clock panel should also show the current "ideal" state of the shot clock based on the timings definition file, as well as the user's simulated shot clock.

## Clock Timings

The timings of the game clock, and the target shot clock timings, will be defined in a config file called timings.csv. This file will be provided and will match timecodes on the YouTube video to actual game timings. This will include the following events:

* Game Clock start
* Game Clock stop
* Shot Clock start
* Shot Clock stop
* Shot Clock Reset to 24 seconds
* Shot Clock Reset to 14 seconds
* Quarter Start
* Quarter End

## User Accuracy

As the user controls their version of the shot clock, the page should calculate an accuracy based on the correct operation of the shot clock from the timings file.

## Other Controls

The user should be able to pause the YouTube video, which will pause the game and shot clock as well. They should be able to resume the video which will result the game and shot clock. They should NOT be able to scrub to a different time in the video.

## Project Specifications

The project should also include a Containerfile which will allow using podman to build a container containing the code for the shot clock page.
