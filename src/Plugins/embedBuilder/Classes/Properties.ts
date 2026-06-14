export enum EmbedProperty {
 AuthorName = 'author-name',
 AuthorIcon = 'author-icon',
 AuthorUrl = 'author-url',
 Thumbnail = 'thumbnail',
 Title = 'title',
 Url = 'url',
 Description = 'description',
 Image = 'image',
 Color = 'color',
 FooterText = 'footer-text',
 FooterIcon = 'footer-icon',
 Timestamp = 'timestamp',
 FieldName = 'field-name',
 FieldValue = 'field-value',
 FieldInline = 'field-inline',
}

export enum PropertyInput {
 Typed = 'typed',
 Text = 'text',
 Link = 'link',
 Image = 'img',
 Color = 'color',
 Toggle = 'toggle',
}

export enum FieldOption {
 Add = 'add',
 Remove = 'remove',
}

export const propertyInputs: Record<EmbedProperty, PropertyInput> = {
 [EmbedProperty.AuthorName]: PropertyInput.Text,
 [EmbedProperty.AuthorIcon]: PropertyInput.Image,
 [EmbedProperty.AuthorUrl]: PropertyInput.Link,
 [EmbedProperty.Thumbnail]: PropertyInput.Image,
 [EmbedProperty.Title]: PropertyInput.Typed,
 [EmbedProperty.Url]: PropertyInput.Link,
 [EmbedProperty.Description]: PropertyInput.Typed,
 [EmbedProperty.Image]: PropertyInput.Image,
 [EmbedProperty.Color]: PropertyInput.Color,
 [EmbedProperty.FooterText]: PropertyInput.Text,
 [EmbedProperty.FooterIcon]: PropertyInput.Image,
 [EmbedProperty.Timestamp]: PropertyInput.Typed,
 [EmbedProperty.FieldName]: PropertyInput.Typed,
 [EmbedProperty.FieldValue]: PropertyInput.Typed,
 [EmbedProperty.FieldInline]: PropertyInput.Toggle,
};

export const propertyLengths: Partial<Record<EmbedProperty, number>> = {
 [EmbedProperty.Title]: 256,
 [EmbedProperty.AuthorName]: 256,
 [EmbedProperty.FieldName]: 256,
 [EmbedProperty.FieldValue]: 1024,
 [EmbedProperty.Description]: 4096,
 [EmbedProperty.FooterText]: 2048,
};

export const topLevelProperties: EmbedProperty[] = [
 EmbedProperty.Title,
 EmbedProperty.Description,
 EmbedProperty.Color,
 EmbedProperty.Url,
 EmbedProperty.Image,
 EmbedProperty.Thumbnail,
 EmbedProperty.AuthorName,
 EmbedProperty.AuthorIcon,
 EmbedProperty.AuthorUrl,
 EmbedProperty.FooterText,
 EmbedProperty.FooterIcon,
 EmbedProperty.Timestamp,
];

export const fieldProperties: EmbedProperty[] = [
 EmbedProperty.FieldName,
 EmbedProperty.FieldValue,
 EmbedProperty.FieldInline,
];

export const fieldLimit = 25;
