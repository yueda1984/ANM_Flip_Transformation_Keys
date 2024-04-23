/*
	Flip Transformation Keys

	Flip Keyframe values on selected pegs and/or drawings.
	You can choose to only modify values on keyframes selected in the timeline, or all keyframes on the selected node(s).
	Only works on 2D Transforamtion. Quarternion, Euler angels are unsupported.
	
	v0.3 - Now we can achieve flipping the side of image by rotating the value toward axis (ideal on vertical flipping).
		   Thanks to user Zedrin for helping me figuring out the equation.
	v0.4 - Now works on 3D Path positions. Thanks to user ChrisF for writing a simple string to num converter.


	Installation:
	
	1) Download and Unarchive the zip file.
	2) Locate to your user scripts folder (a hidden folder):
	   https://docs.toonboom.com/help/harmony-17/premium/scripting/import-script.html	
	   
	3) There is a folder named "src" inside the zip file. Copy all its contents directly to the folder above.
	4) In Harmony, add ANM_Flip_Transformation_Keys function to any toolbar.

	
	Direction:
	
	1) Select keyframes you want to flip from the Timeline view, or select one or more Peg or Drawing modules.
	2) Run Flip_Transformation_Keys.
	3) Set your preferences in the opened dialog.

	
	Author:

		Yu Ueda (raindropmoment.com)
		
*/


var scriptVer = "0.4";
	
	
function ANM_Flip_Transformation_Keys()
{	
	var privateFunctions = new private_functions;		
	

	
	//----------------------------- Checking Selection ----------------------------->	
	
	

	var sNodes = selection.selectedNodes();
	var validNodes = privateFunctions.filterPegAndDrawing(sNodes);
	
	if (validNodes.length < 1)
	{
		MessageBox.information("Please select at least one peg or drawing node.");
		return;
	}

	// Open preference dialog box:
	var userPref = privateFunctions.openDialog();
	
	if (!userPref)
		return;

	

	//----------------- On Each Seleced Node, Create Keyframe List by Attr Then Flip ----------------->

	
	
	scene.beginUndoRedoAccum("Flip transformation values on selected keyframes");	


	
	for (var i = 0; i < validNodes.length; i++)
	{
		var nodeType = node.type(validNodes[i]);		
		var transSettings = privateFunctions.getTransformationSettings(validNodes[i], nodeType);
		var colList = privateFunctions.getColumnList(validNodes[i], nodeType, userPref[2] /* attrs selected by user */, transSettings);

		for (var ii = 0; ii < colList.length; ii++)
		{
			var numKeys = func.numberOfPoints(colList[ii].name);
			var keyTimingList = [];
	
			for (var iii = 0; iii < numKeys; iii++)
			{
				keyTimingList.push(func.pointX(colList[ii].name, iii));
			}
			

			// Stop if current argument column has no keyframe:
			if (keyTimingList.length <= 0)
				break;

			
			// If keyframe selection is enabled by user, ommit keyframes outside the selection:
			var numOfFrames = Timeline.numFrameSel;	
			var firstFrame = Timeline.firstFrameSel;		
			var lastFrame = (firstFrame -1) + numOfFrames;

			if (userPref[0])     //bool selected keys only
				keyTimingList = keyTimingList.filter(function(item){return item >= firstFrame && item <= lastFrame;});

			
			// Flip Keyframe Values:
			for (var iii = 0; iii < keyTimingList.length; iii++)
			{	
				privateFunctions.flipTransformation(colList[ii], nodeType, keyTimingList[iii], userPref[1] /* horizontal or vertical */, userPref[3] /* smart rotation */)
			}
		}
	}


	
	scene.endUndoRedoAccum();
}






function private_functions()
{
	this.filterPegAndDrawing = function(array)
	{
		var filteredArray = array.filter(function(item)
		{
			return node.type(item) == "PEG" || node.type(item) == "READ";
		});
		
		return filteredArray;
	}	
	
		
	this.getTransformationSettings = function(argNode, nodeType)
	{
		var settingList = {};

		settingList["3d_enabled"] = node.getAttr(argNode, 1, "enable3d").boolValue();
	
		if (nodeType == "PEG")		
			settingList["pos_separate"] = node.getAttr(argNode, 1, "position.separate").boolValue();
		else
			settingList["pos_separate"] = node.getAttr(argNode, 1, "offset.separate").boolValue();
	
		settingList["scale_separate"] = node.getAttr(argNode, 1, "scale.separate").boolValue();			
		settingList["rot_separate"] = node.getAttr(argNode, 1, "rotation.separate").boolValue();
		
		return settingList;
	}
	
	
	this.getColumnList = function(argNode, nodeType, includedAttr, settingList)
	{
		var colList = [];
				
		if (includedAttr.indexOf("position") !== -1)
		{
			if (nodeType == "PEG")
				var attrKeyword = "position";
			else
				var attrKeyword = "offset";				
			
			if (settingList["pos_separate"])
			{
				var posXCol = node.linkedColumn(argNode, attrKeyword + ".x");
				var posYCol = node.linkedColumn(argNode, attrKeyword + ".y");					
				colList.push({attr: attrKeyword + ".x", name: posXCol});	
				colList.push({attr: attrKeyword + ".y", name: posYCol});							
			}
			else
			{	
				var posXYZCol = node.linkedColumn(argNode, attrKeyword + ".attr3dpath");	
				colList.push({attr: attrKeyword + ".attr3dpath", name: posXYZCol});	
			}
		}
		
		
		if (includedAttr.indexOf("scale") !== -1)
		{
			if (settingList["scale_separate"])
			{
				var scaleXCol = node.linkedColumn(argNode, "scale.x");
				var scaleYCol = node.linkedColumn(argNode, "scale.y");
				colList.push({attr: "scale.x", name: scaleXCol});
				colList.push({attr: "scale.y", name: scaleYCol});

				if (settingList["3d_enabled"])
				{
					var scaleZCol = node.linkedColumn(argNode, "scale.z");					
					colList.push({attr: "scale.z", name: scaleZCol});
				}
			}
			else
			{
				var scaleXYCol = node.linkedColumn(argNode, "scale.xy");						
				colList.push({attr: "scale.xy", name: scaleXYCol});
			}
		}

		
		if (includedAttr.indexOf("rotation") !== -1)
		{
			if (settingList["3d_enabled"])
			{	
				if (settingList["rot_separate"])
				{
					var rotXCol = node.linkedColumn(argNode, "rotation.anglex");
					var rotYCol = node.linkedColumn(argNode, "rotation.angley");	
					var rotZCol = node.linkedColumn(argNode, "rotation.anglez");			
					colList.push({attr: "rotation.anglex", name: rotXCol});	
					colList.push({attr: "rotation.angley", name: rotYCol});				
					colList.push({attr: "rotation.anglez", name: rotZCol});								
				}
				else
				{
					var rotXYZCol = node.linkedColumn(argNode, "rotation.quaternionpath");			
					colList.push({attr: "rotation.quaternionpath", name: rotXYZCol});					
				}
			}
			else
			{
				var rotZCol = node.linkedColumn(argNode, "rotation.anglez");
				colList.push({attr: "rotation.anglez", name: rotZCol});				
			}
		}
		
		
		if (includedAttr.indexOf("skew") !== -1)
		{
			var skewCol = node.linkedColumn(argNode, "skew");		
			colList.push({attr: "skew", name: skewCol});	
		}
		
		
		return colList;
	}
	
	
	this.flipTransformation = function(col, nodeType, keyTiming, flipHorizontal, smartRotation)
	{
		if (nodeType == "PEG")
			var attrKeyword = "position";
		else
			var attrKeyword = "offset";	
			
		if (col.attr == attrKeyword + ".attr3dpath")
		{
			if (flipHorizontal)
			{
				var keyValue = column.getEntry (col.name, 1, keyTiming);
				keyValue = this.parseFloatNum(keyValue);
			}
			else
			{
				var keyValue = column.getEntry (col.name, 2, keyTiming);
				keyValue = this.parseFloatNum(keyValue);				
			}	
		}
		else	
			var keyValue = column.getEntry (col.name, 0, keyTiming);
		
		if (flipHorizontal)
		{
			switch (col.attr)
			{
				case attrKeyword + ".x": column.setEntry (col.name, 0, keyTiming, keyValue *-1); break;
				case attrKeyword + ".attr3dpath": column.setEntry (col.name, 1, keyTiming, keyValue *-1); break;				
				case "scale.x": column.setEntry (col.name, 0, keyTiming, keyValue *-1); break;
				case "scale.xy": column.setEntry (col.name, 0, keyTiming, keyValue *-1); break;				
				case "skew": column.setEntry (col.name, 0, keyTiming, keyValue *-1); break;
			}
		}
		else
		{
			switch (col.attr)
			{
				case attrKeyword + ".y": column.setEntry (col.name, 0, keyTiming, keyValue *-1); break;
				case attrKeyword + ".attr3dpath": column.setEntry (col.name, 2, keyTiming, keyValue *-1); break;						
				case "scale.y": column.setEntry (col.name, 0, keyTiming, keyValue *-1); break;
				case "scale.xy": column.setEntry (col.name, 0, keyTiming, keyValue *-1); break;
				case "skew": column.setEntry (col.name, 0, keyTiming, keyValue *-1); break;
			}		
		}
		
		if (col.attr == "rotation.anglez")
		{
			if (smartRotation)
			{
				var flippedRotVal = this.getFlippedRotation(keyValue);
				column.setEntry (col.name, 0, keyTiming, flippedRotVal);
			}
			else
				column.setEntry (col.name, 0, keyTiming, keyValue *-1);
		}	
	}
	
	
	this.parseFloatNum = function(argVal)
	{
		var floatVal = parseFloat(argVal);		
		if (isNaN(floatVal))
			floatVal = 0;
		else if (argVal.indexOf("S") !== -1 || argVal.indexOf("W") !== -1 || argVal.indexOf("B") !== -1)
			floatVal *= -1;

		return floatVal;
	};
	
	
	this.getFlippedRotation = function(argVal)
	{
		// Equation only works for values between -360 to 360. Any values outside will be normalized:
		var adjustment = this.removeDecimals(argVal /360) *360;
		argVal -= adjustment;
		
		var from0 = argVal %180;
		
		// Switch the direction of rotation depends on the input's polarity:
		if (argVal >= 0)
			var advancedValue = 180;
		else
			var advancedValue = -180;

		var newValue = argVal + advancedValue -(from0 *2);
		
		// Convert the normalized value to actual value:		
		return newValue += adjustment; 
	}
	
	
	this.removeDecimals = function(argVal)
	{
		if (argVal >= 0)
			return Math.floor(argVal);
		else
			return Math.floor(argVal)+1;
	}
	
	
	this.openDialog = function()
	{
		var loadPref = this.readFile();
		
		optionBox = new Dialog;
		optionBox.title = "Flip Transformation Keys";	

		
		// Keyframe Selection Column:
		var selectionContainer = new GroupBox;
		selectionContainer.title = "Flip Values On:";
		
		var selectedKeysOnly = new RadioButton();	
		selectedKeysOnly.text = "Selected Keyframes Only";
		
		var allKeys = new RadioButton();	
		allKeys.text = "All Keyframes on Selected Node(s)";	
			
		if (loadPref[0] == "true"){selectedKeysOnly.checked = true;}
		else{allKeys.checked = true;}
			
		selectionContainer.add(selectedKeysOnly);	
		selectionContainer.add(allKeys);

		
		// Flipping Axis Column:
		var axisContainer = new GroupBox;
		axisContainer.title = "Axis:";
		
		var axisIsX = new RadioButton();	
		axisIsX.text = "Horizontal";
		
		var axisIsY = new RadioButton();	
		axisIsY.text = "Vertical";	

		if (loadPref[1] == "true"){axisIsX.checked = true;}
		else{axisIsY.checked = true;}
		
		axisContainer.add(axisIsX);	
		axisContainer.add(axisIsY);

		
		// Attribute Column
		var attrContainer = new GroupBox;
		attrContainer.title = "Flip these attributes:";
		
		var inclPosition = new CheckBox();
		inclPosition.text = "Position";		
		
		var inclRotation = new CheckBox();
		inclRotation.text = "Rotation";

		var inclSkew = new CheckBox();
		inclSkew.text = "Skew";
		
		if (loadPref[2].indexOf("position") !== -1)
			inclPosition.checked = true;
		if (loadPref[2].indexOf("rotation") !== -1)
			inclRotation.checked = true;
		if (loadPref[2].indexOf("skew") !== -1)
			inclSkew.checked = true;
			
		attrContainer.add(inclPosition);
		attrContainer.add(inclRotation);
		attrContainer.add(inclSkew);


		// Mirror image Column
		var mirrorImage = new GroupBox;
		mirrorImage.title = "Flip image by: ";

		var inclScale = new RadioButton();
		inclScale.text = "Flip scale";		
		
		var smartRot = new RadioButton();
		smartRot.text = "Rotate toward axis (Ideal on vertical flip)";

		var noImageFlip = new RadioButton();
		noImageFlip.text = "Do not flip";		
		
		if (loadPref[2].indexOf("scale") !== -1)
			inclScale.checked = true;
		if (loadPref[3] == "true")
			smartRot.checked = true;
		if (loadPref[4] == "true")
			noImageFlip.checked = true;

		mirrorImage.add(inclScale);		
		mirrorImage.add(smartRot);
		mirrorImage.add(noImageFlip);
		
		
		optionBox.add(selectionContainer);	
		optionBox.add(axisContainer);	
		optionBox.add(attrContainer);	
		optionBox.add(mirrorImage);
		
		optionBox.addSpace(8);
		
		var rc = optionBox.exec();

		if (!rc)
			return false;

		else
		{
			var keyframeSelection = selectedKeysOnly.checked;
			var flipHorizontal = axisIsX.checked;
			var includedAttr = [];
			var smartRotation = smartRot.checked;
			var noImageFlipping = noImageFlip.checked;		
			
			if (inclPosition.checked){includedAttr.push("position");}
			if (inclRotation.checked){includedAttr.push("rotation");}	
			if (inclSkew.checked){includedAttr.push("skew");}
			if (inclScale.checked){includedAttr.push("scale");};			
							
			var savePref = [keyframeSelection, flipHorizontal, includedAttr, smartRotation, noImageFlipping];	
			this.writeFile(savePref);
			
			return savePref;
		}	
	}

	
	
	this.readFile = function()
	{
		localPath = specialFolders.userScripts + "/YU_Script_Prefs";
		localPath += "/ANM_Flip_Transformation_Keys_Pref";		
		
		if (!File(localPath).exists)
		{
			MessageLog.trace("Preference file doesn't exist. Using the default settings.");
			return ["true", "true", ["position", "rotation", "skew"], "false", "true"];
		}
		else
		{
			var file = new File(localPath);

			var userPref;

			try
			{
				file.open(1)   // Read only
				var userPref = file.readLines();
				file.close();
				
				return userPref;
			}
			catch (err)
			{}
		}
	}	
	
	
	this.writeFile = function(prefArray)
	{
		var localPath = specialFolders.userScripts + "/YU_Script_Prefs";
		var dir = new Dir;
		if (!dir.fileExists(localPath))
			dir.mkdir(localPath);	
		localPath += "/ANM_Flip_Transformation_Keys_Pref";
		var file = new File(localPath);
		
		try
		{
			file.open(2)   // Write only
			file.writeLine(prefArray[0]);
			file.writeLine(prefArray[1]);
			file.writeLine(prefArray[2]);			
			file.writeLine(prefArray[3]);
			file.write(prefArray[4]);			
			file.close();
		  
			this.update();
		}
		catch (err)
		{}
	}	
}