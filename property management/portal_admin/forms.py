from django import forms
from properties.models import Property, PropertyCategory

class PropertyForm(forms.ModelForm):
    category = forms.ChoiceField(
        choices=PropertyCategory.choices,
        widget=forms.Select(attrs={'class': 'form-select'}),
        required=True
    )

    class Meta:
        model = Property
        fields = ['name', 'category', 'address', 'city', 'description', 'image']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. Sunrise Apartments'}),
            'address': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. 104 Ring Road, Westlands'}),
            'city': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'e.g. Nairobi'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Brief details about property amenities or features...'}),
            'image': forms.FileInput(attrs={'class': 'form-control', 'accept': 'image/*'}),
        }