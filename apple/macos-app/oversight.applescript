-- Oversight for Mac
-- A double-clickable app: asks for the setup code from the parent dashboard,
-- then installs the syncing agent using the standard macOS admin-password
-- prompt (no Terminal). The heavy lifting is in Resources/install-agent.sh.
on run
	set defaultServer to "https://oversight.netlify.app"
	try
		set theServer to text returned of (display dialog "Enter your Oversight site address:" default answer defaultServer with title "Oversight" buttons {"Cancel", "Next"} default button "Next")
		set theCode to text returned of (display dialog "Enter the setup code shown in the parent dashboard:" default answer "" with title "Oversight" buttons {"Cancel", "Protect this Mac"} default button "Protect this Mac")
	on error number -128
		return
	end try

	if theCode is "" then
		display dialog "Please enter the setup code from your dashboard." buttons {"OK"} default button "OK" with title "Oversight"
		return
	end if

	set installer to quoted form of (POSIX path of (path to resource "install-agent.sh"))
	try
		do shell script installer & " " & quoted form of theServer & " " & quoted form of theCode with administrator privileges
	on error errMsg number errNum
		if errNum is -128 then return
		display dialog errMsg with title "Oversight" buttons {"OK"} default button "OK" with icon stop
		return
	end try

	display dialog "Done! Oversight is protecting this Mac and will keep your dashboard settings in sync." buttons {"Finish"} default button "Finish" with title "Oversight"
end run
