-- Keep the screenshot pasted into the feedback widget (until now only "had a screenshot" was stored).
ALTER TABLE "Feedback" ADD COLUMN "screenshot" TEXT;
