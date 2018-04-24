import datetime


def datetime_log(msg):
	datetime_msg = datetime.datetime.time(
			datetime.datetime.now()).strftime("%H:%M:%S")

	output = "{}: {}".format(datetime, msg)
	print(output)