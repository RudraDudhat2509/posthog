from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tasks", "0037_codeworkflowconfig_codeprsnapshot_codeworkstream"),
    ]

    operations = [
        migrations.AddField(
            model_name="codeprsnapshot",
            name="head_branch",
            field=models.CharField(
                blank=True,
                null=True,
                max_length=255,
                help_text="PR head (source) branch, used to group follow-up task runs under this PR's workstream",
            ),
        ),
    ]
